import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { getSession, resolveFirmId } from '@/lib/api-auth'
import { verifyKey, isAiProvider, type AiProvider } from '@/lib/ai'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Sem sessão, qualquer anônimo passava um firmId e fazia o servidor usar a
  // chave de IA daquela firma.
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Sessão ausente ou inválida.' }, { status: 401 })

  const { firmId: requestedFirmId, apiKey, provider: requestedProvider } = await req.json()
  const firmId = resolveFirmId(session, requestedFirmId)

  // Testar uma chave avulsa é privilégio de quem administra a firma.
  if (apiKey && !(session.isSuperAdmin || session.role === 'admin')) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  // A tela testa a chave ANTES de salvar, então o provedor precisa vir no
  // corpo: validar uma chave `sk-ant-...` contra a OpenAI daria sempre
  // "inválida". Sem provedor no corpo, cai no que está salvo na firma.
  let provider: AiProvider | null = isAiProvider(requestedProvider) ? requestedProvider : null
  let keyToTest: string | undefined = apiKey

  if ((!keyToTest || !provider) && firmId) {
    const { data } = await supabase
      .from('nf_firm_settings')
      .select('openai_api_key, ai_provider')
      .eq('firm_id', firmId)
      .maybeSingle()
    keyToTest = keyToTest || data?.openai_api_key
    provider = provider || (isAiProvider(data?.ai_provider) ? data.ai_provider : 'openai')
  }

  if (!keyToTest) return NextResponse.json({ error: 'Nenhuma chave configurada' }, { status: 400 })
  if (!provider) return NextResponse.json({ error: 'Provedor não informado' }, { status: 400 })

  const valid = await verifyKey(provider, keyToTest)
  if (!valid) return NextResponse.json({ error: 'Chave inválida' }, { status: 401 })

  return NextResponse.json({ ok: true, provider })
}
