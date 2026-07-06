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
  const { firmName, segment, adminName, adminEmail, adminPassword } = await req.json()

  if (!firmName || !segment || !adminName || !adminEmail || !adminPassword) {
    return NextResponse.json({ error: 'Todos os campos são obrigatórios.' }, { status: 400 })
  }
  if (adminPassword.length < 6) {
    return NextResponse.json({ error: 'A senha precisa ter pelo menos 6 caracteres.' }, { status: 400 })
  }

  const slug = generateSlug(firmName)

  // Criar firma + admin via função SQL segura
  const { data, error } = await supabase.rpc('nf_create_firm', {
    p_name: firmName,
    p_slug: slug,
    p_segment: segment,
    p_admin_name: adminName,
    p_admin_email: adminEmail,
    p_admin_password: adminPassword,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (data?.error) return NextResponse.json({ error: data.error }, { status: 400 })

  // Popular com dados do segmento
  const setupRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://nexusflow-campos-pillar.vercel.app'}/api/setup-firm`, {
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
