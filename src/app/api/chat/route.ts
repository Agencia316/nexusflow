import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

async function getFirmSettings(firmId: string) {
  const { data } = await supabase
    .from('nf_firm_settings')
    .select('openai_api_key, ai_enabled, ai_model, chat_system_prompt, chat_persona')
    .eq('firm_id', firmId)
    .single()
  return data
}

async function getApiKey(settings: any): Promise<string | null> {
  if (settings?.ai_enabled && settings?.openai_api_key) return settings.openai_api_key
  return process.env.OPENAI_API_KEY || null
}

export async function POST(req: NextRequest) {
  const { messages, firmId } = await req.json()

  const settings = await getFirmSettings(firmId)
  const apiKey = await getApiKey(settings)
  const model = settings?.ai_model || 'gpt-4o'

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
      const err = await res.json()
      return NextResponse.json({ error: err.error?.message || 'Erro na API OpenAI' }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json({ content: data.choices[0].message.content })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
