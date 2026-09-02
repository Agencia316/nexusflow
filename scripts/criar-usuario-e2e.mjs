/**
 * Cria (ou recria a senha de) um usuário admin dedicado aos smoke tests
 * autenticados (`npm run test:e2e`) numa firma de TESTE — nunca numa firma real.
 *
 * Usa o mesmo caminho do app (RPC nf_create_user / nf_update_password), mas
 * autenticado com um JWT de super-admin assinado localmente com o
 * SUPABASE_JWT_SECRET do .env.local — a mesma técnica de gerar-sessoes-teste.mjs.
 * Assim o guard da RPC (super ou admin da própria firma) é respeitado e o
 * bcrypt fica a cargo do banco (crypt/gen_salt), igual ao cadastro normal.
 *
 * Uso:
 *   node scripts/criar-usuario-e2e.mjs <slug-da-firma-de-teste>
 * Imprime as três linhas E2E_* para colar no .env.local.
 */
import fs from 'node:fs'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const slug = process.argv[2]
if (!slug) { console.error('uso: node scripts/criar-usuario-e2e.mjs <slug-da-firma-de-teste>'); process.exit(1) }

const env = {}
for (const l of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1')
}
for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_JWT_SECRET']) {
  if (!env[k]) { console.error(`falta ${k} no .env.local`); process.exit(1) }
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// Firma de teste: recusa qualquer nome que não pareça de teste, por segurança.
const { data: firm, error: firmErr } = await admin.from('nf_firms').select('id, name, slug').eq('slug', slug).single()
if (firmErr || !firm) { console.error('firma não encontrada:', slug, firmErr?.message || ''); process.exit(1) }
if (!/teste|test|e2e|demo/i.test(`${firm.name} ${firm.slug}`)) {
  console.error(`recusado: "${firm.name}" (${firm.slug}) não parece firma de teste.`); process.exit(1)
}

// JWT de super-admin (sub = um super-admin real, para satisfazer FKs/auditoria).
const { data: superU } = await admin.from('nf_users').select('id, firm_id').eq('is_super_admin', true).limit(1).single()
if (!superU) { console.error('nenhum super-admin no banco'); process.exit(1) }
const b64 = (b) => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
const sign = (p) => { const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), y = b64(JSON.stringify(p)), d = `${h}.${y}`; return `${d}.${b64(crypto.createHmac('sha256', env.SUPABASE_JWT_SECRET).update(d).digest())}` }
const now = Math.floor(Date.now() / 1000)
const token = sign({ sub: superU.id, role: 'authenticated', aud: 'authenticated', firm_id: superU.firm_id, user_role: 'admin', is_super_admin: true, iat: now, exp: now + 600 })
const asSuper = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } },
})

const email = 'e2e@nexusflow.test'
// Sem '#' nem aspas: o carregador de .env trata '#' como comentário.
const password = 'E2e-' + crypto.randomBytes(9).toString('base64url')

const { data: existing } = await admin.from('nf_users').select('id').eq('email', email).eq('firm_id', firm.id).maybeSingle()
if (existing) {
  const { error } = await asSuper.rpc('nf_update_password', { p_user_id: existing.id, p_new_password: password })
  if (error) { console.error('nf_update_password falhou:', error.message); process.exit(1) }
  console.error(`senha do usuário E2E existente (${existing.id}) redefinida em "${firm.name}"`)
} else {
  const { data: id, error } = await asSuper.rpc('nf_create_user', {
    p_firm_id: firm.id, p_name: 'Robô E2E', p_email: email, p_password: password, p_role: 'admin', p_job_role_id: null,
  })
  if (error) { console.error('nf_create_user falhou:', error.message); process.exit(1) }
  console.error(`usuário E2E criado (${id}) em "${firm.name}"`)
}

// Prova pelo caminho real de login.
const { data: ok, error: loginErr } = await admin.rpc('nf_login', { p_email: email, p_password: password })
if (loginErr || !ok || (Array.isArray(ok) && ok.length === 0)) { console.error('nf_login não aceitou a credencial nova:', loginErr?.message || ok); process.exit(1) }

console.log(`E2E_SLUG=${firm.slug}\nE2E_EMAIL=${email}\nE2E_PASSWORD="${password}"`)
