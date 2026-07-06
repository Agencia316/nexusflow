'use client'

/**
 * Sessão do usuário — token JWT assinado pelo servidor (emitido em /api/session/login).
 *
 * Fase 1: o token é emitido e guardado, mas o cliente de dados AINDA usa a anon
 * key (o RLS continua permissivo). Na Fase 2, quando as policies passarem a exigir
 * `authenticated`, o cliente do Supabase passa a anexar este token e o RLS enforça
 * o isolamento por firma.
 */

const TOKEN_KEY = 'nf_token'

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function clearToken() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
}

/** Decodifica o `exp` do JWT (sem validar assinatura — só p/ saber se venceu). */
export function tokenExp(): number | null {
  const t = getToken()
  if (!t) return null
  try {
    const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch { return null }
}

/** true quando há sessão RLS ligada e o token está ausente ou vencido. */
export function isSessionExpired(): boolean {
  // Só relevante quando o isolamento por tenant está ativo.
  if (process.env.NEXT_PUBLIC_RLS_ENFORCED !== 'true') return false
  const exp = tokenExp()
  if (exp === null) return true // RLS ligado sem token => sessão inválida
  return Date.now() / 1000 >= exp
}
