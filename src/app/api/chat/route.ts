import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { getSession, resolveFirmId } from '@/lib/api-auth'
import { getFirmAI } from '@/lib/firm-ai-context'
import { callAi, aiErrorResponse, AI_NOT_CONFIGURED, type AiMessage } from '@/lib/ai'

export const runtime = 'nodejs'

/**
 * Aceita só o formato que repassamos ao provedor — corpo malformado dava 500.
 * `system` não é aceito aqui: o prompt de sistema é montado pelo servidor, e
 * na Anthropic ele vai num campo próprio, fora de `messages`.
 */
function parseMessages(input: unknown): AiMessage[] | null {
  if (!Array.isArray(input) || input.length === 0) return null
  const ok = input.every(
    (m): m is AiMessage =>
      !!m && typeof m === 'object' &&
      ['user', 'assistant'].includes((m as any).role) &&
      typeof (m as any).content === 'string',
  )
  return ok ? (input as AiMessage[]) : null
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
  // Rota paga (usa a chave de IA da firma): exige sessão.
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
  const { provider, apiKey, model } = await getFirmAI(firmId)

  if (!apiKey) {
    return NextResponse.json({ error: AI_NOT_CONFIGURED }, { status: 503 })
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

  const result = await callAi(provider, {
    apiKey,
    model,
    system: systemPrompt,
    messages,
    maxTokens: 1200,
    temperature: 0.3, // ignorado no Anthropic — ver src/lib/ai/anthropic.ts
  })

  if (result.kind === 'error') {
    // O erro cru do provedor vaza detalhe de infraestrutura (o 401 da OpenAI
    // devolve a chave mascarada). Loga inteiro, responde genérico.
    console.error('[chat] %s %d para firma %s: %s', provider, result.error.status, firmId, result.error.detail)
    const { status, body } = aiErrorResponse(result.error)
    return NextResponse.json(body, { status })
  }

  return NextResponse.json({ content: result.text })
}
