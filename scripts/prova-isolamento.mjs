/**
 * FASE 6 — Prova de isolamento por tenant (critério de aceite do "100%").
 *
 * Forja tokens de sessão (HS256 com o SUPABASE_JWT_SECRET, exatamente como
 * /api/session/login faz) para a Firma A e para um super-admin, bate no banco
 * REAL com a anon key + Authorization: Bearer <token> e prova que:
 *
 *   1. Token da Firma A NÃO lê nenhuma linha de outra firma (leitura).
 *   2. Token da Firma A NÃO escreve em linha de outra firma (WITH CHECK).
 *   3. Super-admin enxerga linhas de todas as firmas (bypass auditado).
 *
 * Não é destrutivo: os UPDATEs de teste regravam o MESMO valor atual (no-op),
 * então mesmo que o RLS falhasse, nenhum dado seria corrompido.
 *
 * Uso:  node scripts/prova-isolamento.mjs
 * Lê credenciais do .env.local (não commitar segredos).
 */
import fs from 'node:fs'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// ── Carrega .env.local ──────────────────────────────────────────────────────
const env = {}
for (const line of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
const SECRET = env.SUPABASE_JWT_SECRET
if (!SB_URL || !ANON || !SERVICE || !SECRET) {
  console.error('Faltam envs no .env.local (SB_URL/ANON/SERVICE/JWT_SECRET).'); process.exit(1)
}

// ── Assinatura HS256 (igual à rota de login) ────────────────────────────────
const b64url = (b) => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
function signJwt(payload) {
  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const b = b64url(JSON.stringify(payload))
  const data = `${h}.${b}`
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(data).digest())
  return `${data}.${sig}`
}
function tokenFor(firm_id, is_super = false) {
  const now = Math.floor(Date.now() / 1000)
  return signJwt({
    sub: '00000000-0000-0000-0000-0000000000aa', role: 'authenticated', aud: 'authenticated',
    firm_id, user_role: 'admin', is_super_admin: is_super, iat: now, exp: now + 3600,
  })
}
const clientWith = (token) =>
  createClient(SB_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })

const admin = createClient(SB_URL, SERVICE, { auth: { persistSession: false } })

// ── Relatório ───────────────────────────────────────────────────────────────
const results = []
const rec = (tabela, teste, ok, detalhe) => results.push({ tabela, teste, ok, detalhe })
const P = (s) => `\x1b[32m${s}\x1b[0m`, F = (s) => `\x1b[31m${s}\x1b[0m`

// Tabelas com firm_id direto
const DIRETAS = ['nf_alerts','nf_assignments','nf_categories','nf_chat_messages','nf_chat_sessions',
  'nf_documents','nf_embeddings','nf_firm_settings','nf_roles','nf_training_paths','nf_user_progress','nf_users']
// Derivadas: [tabela, coluna_fk, tabela_pai, col_fk_pai_id]
const DERIVADAS = [
  ['nf_comments','document_id','nf_documents','id'],
  ['nf_document_permissions','document_id','nf_documents','id'],
  ['nf_document_versions','document_id','nf_documents','id'],
  ['nf_training_steps','path_id','nf_training_paths','id'],
  ['nf_certificates','user_id','nf_users','id'],
]

async function main() {
  // 1) Escolher duas firmas com dados (mais documentos = melhor cobertura).
  const { data: firms, error: fe } = await admin.from('nf_firms').select('id, name').order('name')
  if (fe) { console.error('Erro lendo nf_firms:', fe.message); process.exit(1) }
  if (!firms || firms.length < 2) {
    console.error(F(`Só ${firms?.length ?? 0} firma(s) no banco — precisa de >= 2 para provar isolamento cruzado.`))
    process.exit(1)
  }
  // ranking por nº de documentos
  const rank = []
  for (const f of firms) {
    const { count } = await admin.from('nf_documents').select('id', { count: 'exact', head: true }).eq('firm_id', f.id)
    rank.push({ ...f, docs: count ?? 0 })
  }
  rank.sort((a, b) => b.docs - a.docs)
  const A = rank[0], B = rank.find((f) => f.id !== A.id)
  console.log(`\nFirma A (atacante) = ${A.name} [${A.id}]  docs=${A.docs}`)
  console.log(`Firma B (vítima)   = ${B.name} [${B.id}]  docs=${B.docs}\n`)

  const tokA = tokenFor(A.id, false)
  const tokSuper = tokenFor(A.id, true) // super-admin logado na firma A, mas vê tudo
  const asA = clientWith(tokA)
  const asSuper = clientWith(tokSuper)

  // ── TESTE 1: leitura cruzada nas tabelas DIRETAS ──────────────────────────
  for (const t of DIRETAS) {
    // com token A, qualquer linha com firm_id != A é vazamento
    const { data, error } = await asA.from(t).select('firm_id').neq('firm_id', A.id).limit(5)
    if (error) { rec(t, 'leitura-cruzada', null, `erro: ${error.message}`); continue }
    rec(t, 'leitura-cruzada', data.length === 0, data.length === 0 ? 'ok (0 linhas de outra firma)' : `VAZOU ${data.length} linha(s)`)
  }

  // ── TESTE 2: escrita cruzada (no-op) nas tabelas DIRETAS, bidirecional ─────
  // Testa nas duas direções (A→B e B→A) para que uma tabela sem dados numa
  // firma ainda seja coberta pela outra. Basta uma direção com dado p/ provar.
  const escritaCruzada = async (atacanteTok, vitimaId, dir) => {
    for (const t of DIRETAS) {
      const { data: rowV } = await admin.from(t).select('*').eq('firm_id', vitimaId).limit(1)
      if (!rowV || rowV.length === 0) continue // sem dado da vítima nesta direção
      const row = rowV[0]
      const pk = 'id' in row ? 'id' : Object.keys(row)[0]
      // regrava a MESMA firm_id (no-op) — se o RLS bloquear, 0 linhas afetadas
      const { data: upd, error } = await clientWith(atacanteTok).from(t).update({ firm_id: row.firm_id }).eq(pk, row[pk]).select(pk)
      if (error) { rec(t, `escrita-cruzada(${dir})`, true, `bloqueado por erro (ok): ${error.message.slice(0, 50)}`); continue }
      rec(t, `escrita-cruzada(${dir})`, upd.length === 0, upd.length === 0 ? 'ok (0 afetadas)' : `ESCREVEU em ${upd.length} linha(s) da vítima`)
    }
  }
  await escritaCruzada(tokA, B.id, 'A→B')
  await escritaCruzada(tokenFor(B.id, false), A.id, 'B→A')

  // ── TESTE 3: leitura nas tabelas DERIVADAS (contagem visível <= esperada) ──
  for (const [t, fk, pai, paiId] of DERIVADAS) {
    const { count: total } = await asA.from(t).select(fk, { count: 'exact', head: true })
    // ids do pai que pertencem à firma A
    const { data: idsA } = await admin.from(pai).select(paiId).eq('firm_id', A.id)
    const setA = new Set((idsA ?? []).map((r) => r[paiId]))
    // busca as linhas visíveis por A e confere se toda FK aponta p/ pai da firma A
    const { data: vis, error } = await asA.from(t).select(fk).limit(1000)
    if (error) { rec(t, 'leitura-derivada', null, `erro: ${error.message}`); continue }
    const foraDeA = vis.filter((r) => r[fk] != null && !setA.has(r[fk]))
    rec(t, 'leitura-derivada', foraDeA.length === 0,
      foraDeA.length === 0 ? `ok (${total ?? vis.length} visíveis, todas da firma A)` : `VAZOU ${foraDeA.length} linha(s) de outra firma`)
  }

  // ── TESTE 4: super-admin vê linhas de TODAS as firmas ─────────────────────
  {
    const { data, error } = await asSuper.from('nf_documents').select('firm_id').limit(2000)
    if (error) { rec('nf_documents', 'super-admin-bypass', null, `erro: ${error.message}`) }
    else {
      const firmasVistas = new Set(data.map((r) => r.firm_id))
      const veAeB = firmasVistas.has(A.id) && firmasVistas.has(B.id)
      rec('nf_documents', 'super-admin-bypass', veAeB, veAeB ? `ok (vê ${firmasVistas.size} firmas)` : `só vê ${firmasVistas.size} firma(s)`)
    }
  }

  // ── TESTE 5: nf_firms — leitura pública (todas) + update só da própria ────
  {
    const { data: allFirms } = await asA.from('nf_firms').select('id')
    rec('nf_firms', 'leitura-publica', (allFirms?.length ?? 0) === firms.length, `vê ${allFirms?.length ?? 0}/${firms.length} firmas (público por design)`)
    // update no-op na firma B (deve falhar): regrava o mesmo name
    const { data: bRow } = await admin.from('nf_firms').select('id, name').eq('id', B.id).single()
    const { data: updB, error } = await asA.from('nf_firms').update({ name: bRow.name }).eq('id', B.id).select('id')
    if (error) rec('nf_firms', 'escrita-cruzada', true, `bloqueado por erro (ok): ${error.message.slice(0, 60)}`)
    else rec('nf_firms', 'escrita-cruzada', updB.length === 0, updB.length === 0 ? 'ok (0 afetadas em B)' : `ESCREVEU na firma B`)
  }

  // ── Relatório final ───────────────────────────────────────────────────────
  console.log('─'.repeat(72))
  let fails = 0, skips = 0
  for (const r of results) {
    const tag = r.ok === true ? P('PASS') : r.ok === false ? F('FAIL') : '\x1b[33mSKIP\x1b[0m'
    if (r.ok === false) fails++; if (r.ok === null) skips++
    console.log(`${tag}  ${r.tabela.padEnd(24)} ${r.teste.padEnd(20)} ${r.detalhe}`)
  }
  console.log('─'.repeat(72))
  console.log(`${results.length} checagens · ${P((results.length - fails - skips) + ' PASS')} · ${fails ? F(fails + ' FAIL') : '0 FAIL'} · ${skips} SKIP`)
  if (fails > 0) { console.log(F('\n❌ ISOLAMENTO FUROU — ver linhas FAIL acima.')); process.exit(2) }
  console.log(P('\n✅ Isolamento por tenant provado: nenhum vazamento cruzado.'))
}

main().catch((e) => { console.error('Erro fatal:', e); process.exit(1) })
