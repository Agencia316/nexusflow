import { NextRequest, NextResponse } from 'next/server'
import { getFirmAiContext, getFirmAI } from '@/lib/firm-ai-context'
import { getSession, resolveFirmId } from '@/lib/api-auth'
import { callAi, aiErrorResponse, AI_NOT_CONFIGURED } from '@/lib/ai'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Rota paga: sem sessão, um anônimo escolhia o firmId e queimava a chave de
  // IA daquela firma.
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Sessão ausente ou inválida.' }, { status: 401 })

  const { prompt, firmId: requestedFirmId } = await req.json()
  const firmId = resolveFirmId(session, requestedFirmId)

  // Provedor/chave/modelo da firma (respeita o toggle ai_enabled).
  const { provider, apiKey, model } = await getFirmAI(firmId)

  if (!apiKey) return NextResponse.json({ error: AI_NOT_CONFIGURED }, { status: 503 })

  const { firmContext, segmentContext } = await getFirmAiContext(firmId)

  const systemPrompt = `Você é especialista em documentação operacional para ${segmentContext}.
${firmContext ? `Contexto da empresa: ${firmContext}` : ''}

Crie documentos profissionais em Markdown com:
- Título claro e objetivo
- Seções bem organizadas com ## e ###
- Tabelas quando comparar dados, prazos ou etapas
- Listas e checklists práticos
- Linguagem direta, sem mencionar nomes de pessoas — use apenas cargos
- Informações atualizadas e aplicáveis ao contexto
- Exemplos concretos quando útil

Responda APENAS com JSON: {"title": "Título", "content": "markdown aqui"}
Sem markdown extra, sem explicações, apenas o JSON.`

  const result = await callAi(provider, {
    apiKey,
    model,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Crie um documento sobre: ${prompt}` }],
    maxTokens: 3000,
    temperature: 0.3, // ignorado no Anthropic — ver src/lib/ai/anthropic.ts
  })

  if (result.kind === 'error') {
    console.error('[generate-doc] %s %d para firma %s: %s', provider, result.error.status, firmId, result.error.detail)
    const { status, body } = aiErrorResponse(result.error)
    return NextResponse.json(body, { status })
  }

  try {
    const clean = result.text.replace(/```json|```/g, '').trim()
    return NextResponse.json(JSON.parse(clean))
  } catch {
    // A IA respondeu, mas não em JSON. Antes isso virava um documento de
    // placeholder com 200; agora o cliente sabe que precisa tentar de novo.
    console.error('[generate-doc] resposta não é JSON: %s', result.text.slice(0, 300))
    return NextResponse.json(
      { error: 'A IA não devolveu um documento válido. Tente novamente.' },
      { status: 502 },
    )
  }
}
