import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { getSession } from '@/lib/api-auth'

export const runtime = 'nodejs'

/**
 * Troca da PRÓPRIA senha. O usuário vem do token da sessão (getSession), nunca
 * do corpo — então não dá para trocar a senha de outra pessoa por aqui. A
 * verificação da senha atual e a gravação acontecem no Postgres
 * (nf_set_password_self, restrita a service_role).
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Sessão ausente ou inválida.' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const current = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
  const next = typeof body?.newPassword === 'string' ? body.newPassword : ''

  if (!current || !next) {
    return NextResponse.json({ error: 'Informe a senha atual e a nova.' }, { status: 400 })
  }
  if (next.length < 6) {
    return NextResponse.json({ error: 'A nova senha precisa ter pelo menos 6 caracteres.' }, { status: 400 })
  }
  if (next === current) {
    return NextResponse.json({ error: 'A nova senha precisa ser diferente da atual.' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('nf_set_password_self', {
    p_user_id: session.userId,
    p_current: current,
    p_new: next,
  })

  if (error) {
    console.error('[account/password] erro para usuário %s: %s', session.userId, error.message)
    return NextResponse.json({ error: 'Não foi possível alterar a senha. Tente novamente.' }, { status: 502 })
  }

  switch (data) {
    case 'ok':
      return NextResponse.json({ ok: true })
    case 'wrong':
      return NextResponse.json({ error: 'A senha atual está incorreta.' }, { status: 400 })
    case 'weak':
      return NextResponse.json({ error: 'A nova senha precisa ter pelo menos 6 caracteres.' }, { status: 400 })
    default:
      return NextResponse.json({ error: 'Não foi possível alterar a senha.' }, { status: 400 })
  }
}
