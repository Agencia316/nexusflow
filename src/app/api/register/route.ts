import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { verifyKey, isAiProvider, DEFAULT_MODEL, type AiProvider } from '@/lib/ai'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 40)
}

export async function POST(req: NextRequest) {
  const {
    firmName, segment, adminName, adminEmail, adminPassword, solarUf,
    aiProvider, aiApiKey,
  } = await req.json()

  if (!firmName || !segment || !adminName || !adminEmail || !adminPassword) {
    return NextResponse.json({ error: 'Todos os campos são obrigatórios.' }, { status: 400 })
  }

  // A chave de IA é opcional no cadastro; o provedor só é lido se ela veio.
  const key = typeof aiApiKey === 'string' ? aiApiKey.trim() : ''
  if (key && !isAiProvider(aiProvider)) {
    return NextResponse.json({ error: 'Provedor de IA inválido.' }, { status: 400 })
  }
  const provider: AiProvider | null = key ? (aiProvider as AiProvider) : null
  if (adminPassword.length < 6) {
    return NextResponse.json({ error: 'A senha precisa ter pelo menos 6 caracteres.' }, { status: 400 })
  }

  // Guarda o e-mail sempre normalizado (o login também normaliza) para não
  // falhar por maiúscula/espaço vindos de teclado de celular ou autofill.
  const email = String(adminEmail).trim().toLowerCase()

  const slug = generateSlug(firmName)

  // Criar firma + admin via função SQL segura
  const { data, error } = await supabase.rpc('nf_create_firm', {
    p_name: firmName,
    p_slug: slug,
    p_segment: segment,
    p_admin_name: adminName,
    p_admin_email: email,
    p_admin_password: adminPassword,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (data?.error) return NextResponse.json({ error: data.error }, { status: 400 })

  // Região da empresa solar (calculadora de orçamento já abre nela).
  if (segment === 'solar' && solarUf) {
    await supabase.from('nf_firms').update({ solar_uf: solarUf }).eq('id', data.firm_id)
  }

  // Popular com dados do segmento. Chama a própria instância (origin do request),
  // sem depender de um domínio fixo em env — funciona em qualquer deploy/preview.
  const setupRes = await fetch(new URL('/api/setup-firm', req.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firmId: data.firm_id, segment }),
  })

  const setup = await setupRes.json()

  // Chave de IA do onboarding. A validação acontece DEPOIS de criar a firma:
  // esta rota é pública, e validar antes transformaria /api/register num
  // oráculo gratuito para testar chaves de terceiros. Aqui cada tentativa
  // custa um cadastro real, com e-mail único.
  //
  // Chave inválida não derruba o cadastro: a firma nasce com a IA desligada e
  // o cliente é avisado na tela final. O `ai_enabled` default da coluna é
  // false, então "não configurou" e "configurou errado" convergem no mesmo
  // estado seguro — e o DocuChat mostra o aviso pedindo a chave.
  let aiKeyValid: boolean | null = null
  if (provider && key) {
    aiKeyValid = await verifyKey(provider, key)
    if (aiKeyValid) {
      await supabase.from('nf_firm_settings').update({
        ai_provider: provider,
        ai_model: DEFAULT_MODEL[provider],
        openai_api_key: key,
        ai_enabled: true,
      }).eq('firm_id', data.firm_id)
    } else {
      console.error('[register] chave de IA inválida (%s) no cadastro da firma %s', provider, data.firm_id)
    }
  }

  return NextResponse.json({
    ok: true,
    firmId: data.firm_id,
    userId: data.user_id,
    slug: data.slug,
    segment: data.segment,
    created: setup.created,
    // null = não informou chave; false = informou e é inválida.
    aiKeyValid,
  })
}
