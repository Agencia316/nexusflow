import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

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
  const { firmName, segment, adminName, adminEmail, adminPassword, solarUf } = await req.json()

  if (!firmName || !segment || !adminName || !adminEmail || !adminPassword) {
    return NextResponse.json({ error: 'Todos os campos são obrigatórios.' }, { status: 400 })
  }
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

  return NextResponse.json({
    ok: true,
    firmId: data.firm_id,
    userId: data.user_id,
    slug: data.slug,
    segment: data.segment,
    created: setup.created,
  })
}
