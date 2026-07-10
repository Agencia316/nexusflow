import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { getSession, resolveFirmId } from '@/lib/api-auth'
import { getFirmOpenAI } from '@/lib/firm-ai-context'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Rota paga e que lê documento pela service role: exige sessão.
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Sessão ausente ou inválida.' }, { status: 401 })

  const { documentId, firmId: requestedFirmId, count = 4 } = await req.json()
  const firmId = resolveFirmId(session, requestedFirmId)

  // O documento precisa ser da firma da sessão: a service role ignora o RLS,
  // então sem este filtro qualquer id de documento de qualquer firma seria lido.
  const { data: doc } = await supabase
    .from('nf_documents')
    .select('title, content')
    .eq('id', documentId)
    .eq('firm_id', firmId)
    .single()

  if (!doc) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 })

  // Chave/modelo da firma (respeita o toggle ai_enabled).
  const { apiKey, model } = await getFirmOpenAI(firmId)

  if (!apiKey) {
    return NextResponse.json(
      { error: 'IA não configurada. Acesse Configurações → IA para ativar.' },
      { status: 503 },
    )
  }

  const content = doc.content?.substring(0, 4000) || ''

  const prompt = `Você é um especialista em avaliação de aprendizado. Com base no documento abaixo, crie exatamente ${count} perguntas de múltipla escolha para verificar a compreensão do leitor.

DOCUMENTO: "${doc.title}"
---
${content}
---

REGRAS OBRIGATÓRIAS:
- Crie ${count} perguntas objetivas e diretas sobre o conteúdo acima
- Cada pergunta deve ter exatamente 4 opções (A, B, C, D)
- Apenas UMA opção deve ser correta
- As perguntas devem cobrir os pontos mais importantes do documento
- Use linguagem clara, sem ambiguidade
- NÃO crie perguntas sobre informações que não estão no documento
- "answer" é o índice (0=A, 1=B, 2=C, 3=D) da opção CORRETA

Retorne APENAS JSON válido neste formato exato, sem markdown, sem explicações:
{
  "questions": [
    {
      "q": "Texto da pergunta?",
      "options": ["Opção A", "Opção B", "Opção C", "Opção D"],
      "answer": 0
    }
  ]
}`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''
    const clean = text.replace(/```json|```/g, '').trim()
    const quiz = JSON.parse(clean)

    return NextResponse.json({ quiz })
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro ao gerar quiz: ' + e.message }, { status: 500 })
  }
}
