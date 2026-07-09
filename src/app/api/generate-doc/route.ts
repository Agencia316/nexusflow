import { NextRequest, NextResponse } from 'next/server'
import { getFirmAiContext, getFirmOpenAI } from '@/lib/firm-ai-context'
import { getSession, resolveFirmId } from '@/lib/api-auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Rota paga: sem sessão, um anônimo escolhia o firmId e queimava a chave da
  // OpenAI daquela firma.
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Sessão ausente ou inválida.' }, { status: 401 })

  const { prompt, firmId: requestedFirmId } = await req.json()
  const firmId = resolveFirmId(session, requestedFirmId)

  // Chave/modelo da firma, com a global como fallback.
  const { apiKey, model } = await getFirmOpenAI(firmId)

  if (!apiKey) return NextResponse.json({ error: 'Chave OpenAI não configurada' }, { status: 503 })

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

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 3000,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Crie um documento sobre: ${prompt}` }
        ],
      }),
    })

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content

    // Sem `choices` a chamada falhou. O `|| '{}'` anterior fazia o JSON.parse ter
    // SUCESSO, e a rota respondia 200 com corpo vazio — a tela não mostrava nada.
    if (!text) {
      console.error('[generate-doc] OpenAI não retornou choices:', JSON.stringify(data?.error ?? data).slice(0, 300))
      return NextResponse.json(
        { error: 'A IA não conseguiu gerar o documento. Verifique a chave da OpenAI nas configurações.' },
        { status: 502 },
      )
    }

    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json(parsed)
  } catch (e: any) {
    return NextResponse.json({ title: prompt, content: `# ${prompt}\n\nConteúdo gerado com erro. Tente novamente.` })
  }
}
