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
