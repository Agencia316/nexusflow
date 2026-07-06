import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'editor' | 'member'
  firm_id: string
  firm_name?: string
  firm_segment?: string
  job_role_id?: string
  job_role_name?: string
  /** Usuário master da Três16 — enxerga e gerencia todas as firmas. */
  is_super_admin?: boolean
}

// O login agora tem um caminho único: POST /api/session/login (valida via
// nf_login/bcrypt e emite o token de sessão). A antiga função login() foi
// removida para não haver dois caminhos divergentes.

export function getUser(): User | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('nf_user')
  if (!raw) return null

  const ts = parseInt(localStorage.getItem('nf_login_ts') || '0')
  if (Date.now() - ts > 8 * 60 * 60 * 1000) { logout(); return null }

  try { return JSON.parse(raw) } catch { return null }
}

export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('nf_user')
    localStorage.removeItem('nf_login_ts')
    localStorage.removeItem('nf_firm_id')
    localStorage.removeItem('nf_pending_firm')
    localStorage.removeItem('nf_token')
  }
}

export async function updatePassword(userId: string, newPassword: string): Promise<boolean> {
  const { error } = await supabase.rpc('nf_update_password', {
    p_user_id: userId,
    p_new_password: newPassword
  })
  return !error
}
