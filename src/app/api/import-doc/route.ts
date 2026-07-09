import { NextRequest, NextResponse } from 'next/server'
import { getFirmAiContext, getFirmOpenAI } from '@/lib/firm-ai-context'
import { getSession, resolveFirmId } from '@/lib/api-auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Rota paga (chama a OpenAI): exige sessão.
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Sessão ausente ou inválida.' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const firmId = resolveFirmId(session, formData.get('firmId'))
  const { firmContext } = await getFirmAiContext(firmId)

  // A chave da firma tem precedência sobre a global. Antes esta rota usava só a
  // global, então ficava quebrada em qualquer ambiente sem OPENAI_API_KEY válida.
  const { apiKey, model } = await getFirmOpenAI(firmId)
  if (!apiKey) return NextResponse.json({ error: 'Chave OpenAI não configurada' }, { status: 503 })

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

  // Processar com GPT-4o
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 3000,
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em documentação profissional corporativa.
${firmContext ? `Contexto da empresa: ${firmContext}` : ''}

Analise o texto extraído de um documento e crie uma versão limpa e bem formatada em Markdown.
- Preserve todas as informações importantes
- Organize com títulos ## e ### claros
- Use listas, tabelas e checklists onde fizer sentido
- Remova ruídos, headers/footers de PDF, numerações de página
- Nunca mencione nomes pessoais — use cargos (SDR, Advogado, Closer etc.)
- Retorne APENAS JSON: {"title": "título do documento", "content": "markdown formatado", "tags": ["tag1","tag2"]}
Sem explicações, sem markdown extra ao redor do JSON.`
        },
        {
          role: 'user',
          content: `Nome do arquivo: ${file.name}\n\nConteúdo extraído:\n${textToProcess}`
        }
      ],
    }),
  })

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content

  // Sem `choices` a chamada à OpenAI falhou (chave inválida, quota, etc.).
  // Antes isso virava a string '{}', que faz JSON.parse ter SUCESSO — a rota
  // devolvia 200 com corpo vazio e a tela de importar não mostrava nada.
  if (!text) {
    console.error('[import-doc] OpenAI não retornou choices:', JSON.stringify(data?.error ?? data).slice(0, 300))
    return NextResponse.json(
      { error: 'A IA não conseguiu processar o arquivo. Verifique a chave da OpenAI nas configurações.' },
      { status: 502 },
    )
  }

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
