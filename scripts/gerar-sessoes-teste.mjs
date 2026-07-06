/**
 * Gera "pacotes de sessão" (JWT forjado + objeto nf_user) para 1 usuário de cada
 * papel + super-admin, a partir dos usuários REAIS do banco. Usado para testar a
 * UI por papel via browser sem precisar das senhas (não-destrutivo, read-only).
 *
 * Saída: imprime JSON com { admin, editor, member, super } → cada um com o que
 * injetar no localStorage. Redirecione para um arquivo no scratchpad.
 */
import fs from 'node:fs'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const l of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim()
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const b64 = (b) => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
const sign = (p) => { const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), y = b64(JSON.stringify(p)), d = `${h}.${y}`; return `${d}.${b64(crypto.createHmac('sha256', env.SUPABASE_JWT_SECRET).update(d).digest())}` }
const tokenFor = (u) => { const now = Math.floor(Date.now() / 1000); return sign({ sub: u.id, role: 'authenticated', aud: 'authenticated', firm_id: u.firm_id, user_role: u.role, is_super_admin: !!u.is_super_admin, iat: now, exp: now + 8 * 3600 }) }

const { data: firms } = await admin.from('nf_firms').select('id, name, slug, segment')
const firmById = Object.fromEntries((firms || []).map((f) => [f.id, f]))
const { data: users } = await admin.from('nf_users').select('id, name, email, role, firm_id, is_super_admin').order('firm_id')

// firma com mais usuários "normais" p/ cobrir admin/editor/member
const counts = {}
for (const u of users) if (!u.is_super_admin) counts[u.firm_id] = (counts[u.firm_id] || 0) + 1
const firmA = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]

const pick = (role) => users.find((u) => u.firm_id === firmA && u.role === role && !u.is_super_admin)
const superU = users.find((u) => u.is_super_admin)

const pack = (u, label) => {
  if (!u) return { label, missing: true }
  const f = firmById[u.firm_id] || {}
  const nfUser = { id: u.id, name: u.name, email: u.email, role: u.role, firm_id: u.firm_id, is_super_admin: !!u.is_super_admin, firm_name: f.name, firm_segment: f.segment }
  return { label, email: u.email, role: u.role, firm: f.name, slug: f.slug, localStorage: {
    nf_token: tokenFor(u), nf_user: JSON.stringify(nfUser), nf_login_ts: String(Date.now()), nf_firm_id: u.firm_id, nf_firm_slug: f.slug || '',
  } }
}

const out = {
  firmA: firmById[firmA]?.name,
  firms: (firms || []).map((f) => ({ name: f.name, slug: f.slug, segment: f.segment })),
  admin: pack(pick('admin'), 'admin'),
  editor: pack(pick('editor'), 'editor'),
  member: pack(pick('member'), 'member'),
  super: pack(superU, 'super-admin'),
  usersByFirm: (firms || []).map((f) => ({ firm: f.name, users: users.filter((u) => u.firm_id === f.id).map((u) => `${u.role}${u.is_super_admin ? '*' : ''}: ${u.email}`) })),
}
console.log(JSON.stringify(out, null, 2))
