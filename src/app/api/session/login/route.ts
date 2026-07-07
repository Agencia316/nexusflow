import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Caminho ÚNICO de login (Fase 1). Valida via nf_login (bcrypt) e emite um JWT
// assinado com o segredo do projeto, que na Fase 2 passa a ser exigido pelo RLS.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

// HS256 sem dependências externas (aceito pelo PostgREST do Supabase).
function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  const data = `${header}.${body}`
  const sig = b64url(crypto.createHmac('sha256', secret).update(data).digest())
  return `${data}.${sig}`
}

export async function POST(req: NextRequest) {
  const { email: rawEmail, password, firmId } = await req.json()
  if (!rawEmail || !password) {
    return NextResponse.json({ error: 'Informe e-mail e senha.' }, { status: 400 })
  }
  // Normaliza o e-mail: teclado de celular capitaliza e autofill deixa espaço,
  // o que fazia o login falhar mesmo com a senha certa.
  const email = String(rawEmail).trim().toLowerCase()

  const { data, error } = await supabase.rpc('nf_login', {
    p_email: email, p_password: password,
  })
  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 })
  }
  const row = data[0]

  // Trava de firma (quando o login vem por uma URL /[slug] específica).
  if (firmId && row.firm_id !== firmId) {
    return NextResponse.json({ error: 'Esse usuário não pertence a esta empresa.' }, { status: 403 })
  }

  const secret = process.env.SUPABASE_JWT_SECRET
  let token: string | null = null
  if (secret) {
    const now = Math.floor(Date.now() / 1000)
    token = signJwt({
      sub: row.id,
      role: 'authenticated',
      aud: 'authenticated',
      firm_id: row.firm_id,
      user_role: row.role,
      is_super_admin: !!row.is_super_admin,
      iat: now,
      exp: now + 8 * 60 * 60, // 8h, igual à sessão atual
    }, secret)
  }

  return NextResponse.json({
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      firm_id: row.firm_id,
      is_super_admin: !!row.is_super_admin,
    },
    token,
  })
}
