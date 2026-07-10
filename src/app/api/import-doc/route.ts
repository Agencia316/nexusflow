import { NextRequest, NextResponse } from 'next/server'
import { getFirmAiContext, getFirmAI } from '@/lib/firm-ai-context'
import { getSession, resolveFirmId } from '@/lib/api-auth'
import { callAi, aiErrorResponse, AI_NOT_CONFIGURED } from '@/lib/ai'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Rota paga (chama o provedor de IA da firma): exige sessão.
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Sessão ausente ou inválida.' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const firmId = resolveFirmId(session, formData.get('firmId'))
  const { firmContext } = await getFirmAiContext(firmId)

  // Cada firma usa a própria chave; não há global. Antes esta rota usava só a
  // global, então ficava quebrada em qualquer ambiente sem OPENAI_API_KEY válida.
  const { provider, apiKey, model } = await getFirmAI(firmId)
  if (!apiKey) return NextResponse.json({ error: AI_NOT_CONFIGURED }, { status: 503 })

  if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase()
  let rawText = ''

  if (ext === 'txt' || ext === 'md') {
    rawText = await file.text()
  } else if (ext === 'pdf' || ext === 'docx' || ext === 'doc') {
    // Para PDF e DOCX: extrair texto via ArrayBuffer e enviar para IA processar
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    
    // Tentar extrair texto legível do buffer (funciona para alguns PDFs com texto embutido)
    const decoder = new TextDecoder('utf-8', { fatal: false })
    const raw = decoder.decode(bytes)
    // Pegar apenas sequências de texto legível
    const readable = raw.match(/[\x20-\x7E\u00C0-\u024F\u0400-\u04FF\n\r\t]{4,}/g) || []
    rawText = readable.join(' ').replace(/\s+/g, ' ').trim()
    
    if (rawText.length < 100) {
      rawText = `[Arquivo: ${file.name}] — Conteúdo não pôde ser extraído automaticamente. Por favor, cole o texto manualmente ou use um arquivo .txt ou .md.`
    }
  } else {
    rawText = await file.text()
  }

  // Limitar tamanho para não estourar contexto
  const textToProcess = rawText.substring(0, 8000)

  const result = await callAi(provider, {
    apiKey,
    model,
    system: `Você é um especialista em documentação profissional corporativa.
${firmContext ? `Contexto da empresa: ${firmContext}` : ''}

Analise o texto extraído de um documento e crie uma versão limpa e bem formatada em Markdown.
- Preserve todas as informações importantes
- Organize com títulos ## e ### claros
- Use listas, tabelas e checklists onde fizer sentido
- Remova ruídos, headers/footers de PDF, numerações de página
- Nunca mencione nomes pessoais — use cargos (SDR, Advogado, Closer etc.)
- Retorne APENAS JSON: {"title": "título do documento", "content": "markdown formatado", "tags": ["tag1","tag2"]}
Sem explicações, sem markdown extra ao redor do JSON.`,
    messages: [
      { role: 'user', content: `Nome do arquivo: ${file.name}\n\nConteúdo extraído:\n${textToProcess}` },
    ],
    maxTokens: 3000,
  })

  if (result.kind === 'error') {
    console.error('[import-doc] %s %d para firma %s: %s', provider, result.error.status, firmId, result.error.detail)
    const { status, body } = aiErrorResponse(result.error)
    return NextResponse.json(body, { status })
  }

  const text = result.text

  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return NextResponse.json(JSON.parse(clean))
  } catch {
    // A IA respondeu, mas fora do formato JSON pedido: devolve o texto cru.
    return NextResponse.json({
      title: file.name.replace(/\.[^.]+$/, ''),
      content: textToProcess,
      tags: []
    })
  }
}
