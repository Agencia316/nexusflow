import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

// Busca semântica melhorada: combina Postgres full-text search + ranking por relevância
export async function POST(req: NextRequest) {
  const { query, firmId } = await req.json()
  if (!query?.trim()) return NextResponse.json({ results: [] })

  // Preprocessar query: extrair termos importantes
  const terms = query
    .toLowerCase()
    .replace(/[^\w\sáéíóúãõâêôçàüñ]/g, ' ')
    .split(/\s+/)
    .filter((w: string) => w.length > 2)

  // Buscar todos os docs publicados da firma
  const { data: docs } = await supabase
    .from('nf_documents')
    .select('id, title, content, tags, category_id, view_count')
    .eq('firm_id', firmId)
    .eq('status', 'published')

  if (!docs?.length) return NextResponse.json({ results: [] })

  // Score por relevância: título > tags > conteúdo
  const scored = docs.map((doc: any) => {
    const titleLow = doc.title?.toLowerCase() || ''
    const contentLow = doc.content?.toLowerCase() || ''
    const tagsLow = (doc.tags || []).join(' ').toLowerCase()

    let score = 0

    for (const term of terms) {
      // Título: peso 10
      if (titleLow.includes(term)) score += 10
      // Match exato título: peso extra 5
      if (titleLow === term) score += 5
      // Tags: peso 7
      if (tagsLow.includes(term)) score += 7
      // Conteúdo: peso 1 por ocorrência (max 10)
      const contentMatches = (contentLow.match(new RegExp(term, 'g')) || []).length
      score += Math.min(contentMatches, 10)
    }

    // Boost por popularidade
    score += Math.log(1 + (doc.view_count || 0)) * 0.5

    // Snippet: pegar trecho relevante do conteúdo
    let snippet = ''
    for (const term of terms) {
      const idx = contentLow.indexOf(term)
      if (idx >= 0) {
        const start = Math.max(0, idx - 60)
        const end = Math.min(contentLow.length, idx + 120)
        snippet = '...' + doc.content.substring(start, end).replace(/[#*`]/g, '').trim() + '...'
        break
      }
    }
    if (!snippet && doc.content) {
      snippet = doc.content.replace(/[#*`]/g, '').substring(0, 150).trim() + '...'
    }

    return { ...doc, score, snippet }
  })

  // Ordenar por score, retornar top 8
  const results = scored
    .filter((d: any) => d.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 8)
    .map(({ score, content, ...rest }: any) => rest)

  // Se nenhum resultado, usar IA para interpretar intenção
  if (results.length === 0 && query.length > 10) {
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 100,
        messages: [{
          role: 'system',
          content: 'Extraia 3-5 palavras-chave em português da pergunta do usuário. Retorne apenas as palavras separadas por vírgula, sem explicações.'
        }, {
          role: 'user', content: query
        }]
      })
    })
    const aiData = await aiRes.json()
    const keywords = aiData.choices?.[0]?.message?.content?.split(',').map((k: string) => k.trim()) || []

    const aiScored = docs.map((doc: any) => {
      const text = `${doc.title} ${(doc.tags||[]).join(' ')} ${doc.content}`.toLowerCase()
      const score = keywords.filter((k: string) => text.includes(k.toLowerCase())).length
      return { ...doc, score, snippet: doc.content?.substring(0, 150).replace(/[#*`]/g,'').trim() + '...' }
    })
    .filter((d: any) => d.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 5)
    .map(({ score, content, ...rest }: any) => rest)

    return NextResponse.json({ results: aiScored, aiEnhanced: true })
  }

  return NextResponse.json({ results })
}
