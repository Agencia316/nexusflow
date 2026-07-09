import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { getSession, resolveFirmId } from '@/lib/api-auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Sem sessão, qualquer anônimo passava um firmId e fazia o servidor usar a
  // chave da OpenAI daquela firma.
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Sessão ausente ou inválida.' }, { status: 401 })

  const { firmId: requestedFirmId, apiKey } = await req.json()
  const firmId = resolveFirmId(session, requestedFirmId)

  // Testar uma chave avulsa é privilégio de quem administra a firma.
  if (apiKey && !(session.isSuperAdmin || session.role === 'admin')) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

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
