import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// FIRM_ID dinâmico: lê da sessão (localStorage) ou do env como fallback
export const FIRM_ID =
  (typeof window !== 'undefined' && localStorage.getItem('nf_firm_id'))
  || process.env.NEXT_PUBLIC_FIRM_ID
  || '00000000-0000-0000-0000-000000000001'
