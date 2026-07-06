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

export async function login(email: string, password: string): Promise<User | null> {
  const { data, error } = await supabase
    .rpc('nf_login', { p_email: email, p_password: password })

  if (error || !data || data.length === 0) return null

  const row = data[0]

  const [firmRes, roleRes] = await Promise.all([
    supabase.from('nf_firms').select('name, segment').eq('id', row.firm_id).single(),
    row.job_role_id
      ? supabase.from('nf_roles').select('name').eq('id', row.job_role_id).single()
      : Promise.resolve({ data: null }),
  ])

  const user: User = {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    firm_id: row.firm_id,
    firm_name: firmRes.data?.name || '',
    firm_segment: firmRes.data?.segment || 'advocacia',
    job_role_id: row.job_role_id || undefined,
    job_role_name: (roleRes as any).data?.name || undefined,
    is_super_admin: !!row.is_super_admin,
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem('nf_user', JSON.stringify(user))
    localStorage.setItem('nf_login_ts', Date.now().toString())
    localStorage.setItem('nf_firm_id', row.firm_id)
  }

  return user
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('nf_user')
  if (!raw) return null

  const ts = parseInt(localStorage.getItem('nf_login_ts') || '0')
  if (Date.now() - ts > 8 * 60 * 60 * 1000) { logout(); return null }

  try { return JSON.parse(raw) } catch { return null }
}

export function getFirmId(): string {
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_FIRM_ID || ''
  return localStorage.getItem('nf_firm_id') || process.env.NEXT_PUBLIC_FIRM_ID || ''
}

export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('nf_user')
    localStorage.removeItem('nf_login_ts')
    localStorage.removeItem('nf_firm_id')
    localStorage.removeItem('nf_pending_firm')
  }
}

export async function updatePassword(userId: string, newPassword: string): Promise<boolean> {
  const { error } = await supabase.rpc('nf_update_password', {
    p_user_id: userId,
    p_new_password: newPassword
  })
  return !error
}
