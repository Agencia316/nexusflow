import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Fase 2 (flag): quando NEXT_PUBLIC_RLS_ENFORCED === 'true', o cliente anexa o
 * token de sessão (nf_token) em toda requisição via `accessToken`, e o RLS por
 * tenant enforça o isolamento. Sem sessão (antes do login) usa a anon key —
 * necessário para ler a marca da firma na tela de login.
 *
 * Desligado (padrão), o comportamento é exatamente o atual (só anon key).
 * Ligar SOMENTE depois que a migration 0004 (policies por tenant) estiver
 * aplicada — caso contrário as telas ficam vazias (policies antigas são `to anon`).
 */
const RLS_ENFORCED = process.env.NEXT_PUBLIC_RLS_ENFORCED === 'true'

export const supabase = RLS_ENFORCED
  ? createClient(URL, ANON, {
      accessToken: async () => {
        const t = typeof window !== 'undefined' ? localStorage.getItem('nf_token') : null
        return t || ANON // sem token → anon key (leitura pública pré-login)
      },
    })
  : createClient(URL, ANON)
