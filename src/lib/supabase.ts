import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * @deprecated Não use em componentes. Lê o localStorage só uma vez no load do
 * módulo, então NÃO reage à troca de firma do super-admin ("entrar como cliente").
 * Use `useFirm().firmId` de `@/lib/firm-context`. Mantido apenas para código
 * server-side/legado que não tem acesso ao contexto React.
 */
export const FIRM_ID =
  (typeof window !== 'undefined' && localStorage.getItem('nf_firm_id'))
  || process.env.NEXT_PUBLIC_FIRM_ID
  || '00000000-0000-0000-0000-000000000001'
