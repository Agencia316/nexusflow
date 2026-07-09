import crypto from 'crypto'
import type { NextRequest } from 'next/server'

/**
 * Verificação da sessão nas rotas /api/* — SOMENTE SERVIDOR.
 * Depende de SUPABASE_JWT_SECRET; nunca importar de um componente 'use client'.
 *
 * O token é o mesmo JWT HS256 emitido por /api/session/login e guardado em
 * localStorage.nf_token. O cliente o envia no header `Authorization: Bearer`.
 */

export type Session = {
  userId: string
  firmId: string
  role: string
  isSuperAdmin: boolean
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/** Verifica assinatura HS256 + expiração e devolve o payload, ou null. */
export function verifyJwt(token: string, secret: string): Record<string, any> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h, b, s] = parts
  const expected = b64url(crypto.createHmac('sha256', secret).update(`${h}.${b}`).digest())
  const sig = Buffer.from(s)
  const exp = Buffer.from(expected)
  if (sig.length !== exp.length || !crypto.timingSafeEqual(sig, exp)) return null
  let payload: Record<string, any>
  try {
    payload = JSON.parse(Buffer.from(b.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
  } catch { return null }
  if (typeof payload.exp === 'number' && Date.now() / 1000 >= payload.exp) return null
  return payload
}

/** Sessão do chamador, ou null se ausente/inválida/expirada. */
export function getSession(req: NextRequest): Session | null {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) return null

  const header = req.headers.get('authorization') || ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const payload = verifyJwt(token, secret)
  if (!payload?.sub || !payload?.firm_id) return null

  return {
    userId: String(payload.sub),
    firmId: String(payload.firm_id),
    role: String(payload.user_role || ''),
    isSuperAdmin: payload.is_super_admin === true,
  }
}

/**
 * Resolve a firma que a requisição pode operar.
 *
 * O `firmId` do corpo da requisição NÃO é confiável: era por ele que qualquer
 * anônimo escolhia de qual firma usar a chave da OpenAI. A firma vem do token.
 *
 * A exceção é o super-admin (Três16), que legitimamente opera outras firmas
 * pelo "entrar como cliente" — só para ele o `firmId` pedido é respeitado.
 */
export function resolveFirmId(session: Session, requestedFirmId?: unknown): string {
  if (session.isSuperAdmin && typeof requestedFirmId === 'string' && requestedFirmId) {
    return requestedFirmId
  }
  return session.firmId
}
