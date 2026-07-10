import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { getSession, resolveFirmId } from '@/lib/api-auth'
import { getFirmOpenAI } from '@/lib/firm-ai-context'

export const runtime = 'nodejs'

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string }

/** Aceita só o formato que repassamos à OpenAI — corpo malformado dava 500. */
function parseMessages(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input) || input.length === 0) return null
  const ok = input.every(
    (m): m is ChatMessage =>
      !!m && typeof m === 'object' &&
      ['user', 'assistant', 'system'].includes((m as any).role) &&
      typeof (m as any).content === 'string',
  )
  return ok ? (input as ChatMessage[]) : null
}

async function getChatSettings(firmId: string) {
  const { data } = await supabase
    .from('nf_firm_settings')
    .select('chat_system_prompt, chat_persona')
    .eq('firm_id', firmId)
    .maybeSingle()
  return data
}

export async function POST(req: NextRequest) {
  // Rota paga (usa a chave da OpenAI da firma): exige sessão.
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Sessão ausente ou inválida.' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const messages = parseMessages(body?.messages)
  if (!messages) {
    return NextResponse.json(
      { error: 'Corpo inválido: "messages" deve ser uma lista de {role, content}.' },
      { status: 400 },
    )
  }
  const firmId = resolveFirmId(session, body?.firmId)

  const settings = await getChatSettings(firmId)
  const { apiKey, model } = await getFirmOpenAI(firmId)

  if (!apiKey) {
    return NextResponse.json({
      error: 'IA não configurada. Acesse Configurações → IA para ativar.'
    }, { status: 503 })
  }

  // Buscar documentos da firma para contexto RAG
  const { data: docs } = await supabase
    .from('nf_documents')
    .select('title, content, tags, category_id')
    .eq('firm_id', firmId)
    .eq('status', 'published')
    .order('view_count', { ascending: false })
    .limit(25)

  const docsContext = (docs || []).map(d =>
    `### ${d.title}\n${d.content?.substring(0, 1200)}`
  ).join('\n\n---\n\n')

  // System prompt: usa o personalizado da firma + RAG dos documentos
  const basePrompt = settings?.chat_system_prompt || 
    'Você é o assistente de conhecimento interno da empresa. Responda com base nos documentos abaixo.'

  const systemPrompt = `${basePrompt}

---
# DOCUMENTOS DA BASE DE CONHECIMENTO:
${docsContext}

---
INSTRUÇÃO FINAL: Responda sempre em português brasileiro. Se a pergunta não estiver coberta pelos documentos acima nem pelo seu conhecimento especializado, diga claramente que não encontrou a informação e sugira consultar o responsável.`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
      }),
    })

    if (!res.ok) {
      // A mensagem crua da OpenAI vaza detalhe de infraestrutura ao cliente
      // (o 401 devolve a chave mascarada). Loga inteiro, responde genérico.
      const err = await res.json().catch(() => ({}))
      console.error('[chat] OpenAI %d para firma %s: %o', res.status, firmId, err)
      const upstreamAuth = res.status === 401 || res.status === 403
      return NextResponse.json(
        {
          error: upstreamAuth
            ? 'IA indisponível: a chave da OpenAI desta firma é inválida. Verifique em Configurações → IA.'
            : 'IA indisponível no momento. Tente novamente em instantes.',
        },
        { status: upstreamAuth ? 502 : 503 },
      )
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string') {
      console.error('[chat] resposta inesperada da OpenAI: %o', data)
      return NextResponse.json({ error: 'IA indisponível no momento.' }, { status: 502 })
    }
    return NextResponse.json({ content })
  } catch (e: any) {
    console.error('[chat] falha ao chamar a OpenAI:', e)
    return NextResponse.json({ error: 'IA indisponível no momento.' }, { status: 502 })
  }
}
