import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const { prompt, firmContext, firmId, segment } = await req.json()

  // Buscar chave/modelo da empresa
  const { data: settings } = firmId ? await supabase
    .from('nf_firm_settings')
    .select('openai_api_key, ai_model, ai_enabled')
    .eq('firm_id', firmId)
    .single() : { data: null }

  const apiKey = settings?.openai_api_key || process.env.OPENAI_API_KEY
  const model = settings?.ai_model || 'gpt-4o'

  if (!apiKey) return NextResponse.json({ error: 'Chave OpenAI não configurada' }, { status: 503 })

  const segmentContext = segment === 'solar'
    ? 'empresa de energia solar fotovoltaica — vendas, instalação, projetos, financiamento, pós-venda'
    : 'escritório de advocacia previdenciária — Auxílio-Acidente INSS, B-36, B-94, critérios J1-J5, SDR, Closer'

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
    const text = data.choices?.[0]?.message?.content || '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json(parsed)
  } catch (e: any) {
    return NextResponse.json({ title: prompt, content: `# ${prompt}\n\nConteúdo gerado com erro. Tente novamente.` })
  }
}
