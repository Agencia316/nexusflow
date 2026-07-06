import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const { firmId, apiKey } = await req.json()

  // Usar chave passada ou buscar do banco
  let keyToTest = apiKey
  if (!keyToTest && firmId) {
    const { data } = await supabase
      .from('nf_firm_settings')
      .select('openai_api_key')
      .eq('firm_id', firmId)
      .single()
    keyToTest = data?.openai_api_key
  }

  if (!keyToTest) return NextResponse.json({ error: 'Nenhuma chave configurada' }, { status: 400 })

  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${keyToTest}` }
    })
    if (!res.ok) return NextResponse.json({ error: 'Chave inválida' }, { status: 401 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro de conexão' }, { status: 500 })
  }
}
