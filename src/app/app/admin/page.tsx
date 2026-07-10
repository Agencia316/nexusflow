'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { useFirm } from '@/lib/firm-context'
import { useRouter } from 'next/navigation'
import {
  Building2, Users, FileText, LogIn, Pencil, Power,
  Loader2, Save, X, Search, ExternalLink, ShieldCheck, Plus, Sun
} from 'lucide-react'

interface FirmRow {
  id: string
  name: string
  slug: string
  segment: string
  plan: string | null
  status: string | null
  created_at: string
  users: number
  activeUsers: number
  docs: number
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active:    { label: 'Ativo',     cls: 'badge-success' },
  trial:     { label: 'Trial',     cls: 'badge-info' },
  suspended: { label: 'Suspenso',  cls: 'badge-danger' },
}

const SEGMENTS = [
  { value: 'advocacia', label: 'Advocacia', icon: '⚖️' },
  { value: 'solar', label: 'Energia Solar', icon: '☀️' },
]

function segIcon(seg: string) {
  return SEGMENTS.find(s => s.value === seg)?.icon || '🏢'
}

export default function AdminPage() {
  const router = useRouter()
  const { setActiveFirm } = useFirm()

  const [firms, setFirms] = useState<FirmRow[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  // Modal de edição
  const [editing, setEditing] = useState<FirmRow | null>(null)
  const [form, setForm] = useState({ name: '', slug: '', segment: 'advocacia', plan: '', status: 'active' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const u = getUser()
    if (!u?.is_super_admin) { router.push('/app/dashboard'); return }
    load()
    // Guarda de montagem: roda uma vez. router é ref estável; load só é chamado aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setLoading(true)
    const [firmsRes, usersRes, docsRes, logsRes] = await Promise.all([
      supabase.from('nf_firms').select('id,name,slug,segment,plan,status,created_at').order('created_at'),
      supabase.from('nf_users').select('firm_id,is_active'),
      supabase.from('nf_documents').select('firm_id'),
      supabase.from('nf_impersonation_log').select('firm_id,created_at').order('created_at', { ascending: false }).limit(10),
    ])
    setLogs(logsRes.data || [])

    const userCount: Record<string, number> = {}
    const activeCount: Record<string, number> = {}
    for (const u of (usersRes.data || [])) {
      userCount[u.firm_id] = (userCount[u.firm_id] || 0) + 1
      if (u.is_active) activeCount[u.firm_id] = (activeCount[u.firm_id] || 0) + 1
    }
    const docCount: Record<string, number> = {}
    for (const d of (docsRes.data || [])) docCount[d.firm_id] = (docCount[d.firm_id] || 0) + 1

    setFirms((firmsRes.data || []).map((f: any) => ({
      ...f,
      users: userCount[f.id] || 0,
      activeUsers: activeCount[f.id] || 0,
      docs: docCount[f.id] || 0,
    })))
    setLoading(false)
  }

  function enterFirm(f: FirmRow) {
    setActiveFirm(f.id)
    router.push('/app/dashboard')
  }

  async function toggleStatus(f: FirmRow) {
    setBusy(f.id)
    const next = f.status === 'suspended' ? 'active' : 'suspended'
    await supabase.from('nf_firms').update({ status: next }).eq('id', f.id)
    setFirms(prev => prev.map(x => x.id === f.id ? { ...x, status: next } : x))
    setBusy(null)
  }

  function openEdit(f: FirmRow) {
    setEditing(f)
    setForm({ name: f.name, slug: f.slug, segment: f.segment, plan: f.plan || '', status: f.status || 'active' })
  }

  async function saveEdit() {
    if (!editing) return
    if (!form.name.trim() || !form.slug.trim()) return
    setSaving(true)
    const patch = {
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase().replace(/\s+/g, '-'),
      segment: form.segment,
      plan: form.plan.trim() || null,
      status: form.status,
    }
    await supabase.from('nf_firms').update(patch).eq('id', editing.id)
    setFirms(prev => prev.map(x => x.id === editing.id ? { ...x, ...patch } : x))
    setSaving(false)
    setEditing(null)
  }

  const filtered = firms.filter(f =>
    !search ||
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.slug.toLowerCase().includes(search.toLowerCase()),
  )

  const totals = firms.reduce((acc, f) => ({
    users: acc.users + f.users,
    docs: acc.docs + f.docs,
  }), { users: 0, docs: 0 })

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Administração de Clientes</h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">Painel Três16 · {firms.length} firma{firms.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => router.push('/app/admin/solar')}
            className="flex items-center justify-center gap-2 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-semibold px-4 py-2 rounded-xl text-sm transition">
            <Sun className="w-4 h-4" /> Config. Solar
          </button>
          <a href="/cadastro" target="_blank"
            className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-onaccent font-semibold px-4 py-2 rounded-xl text-sm transition">
            <Plus className="w-4 h-4" /> Novo cliente
          </a>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Firmas', value: firms.length, icon: Building2, color: 'text-amber-400' },
          { label: 'Usuários', value: totals.users, icon: Users, color: 'text-blue-400' },
          { label: 'Documentos', value: totals.docs, icon: FileText, color: 'text-green-400' },
        ].map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <Icon className={`w-4 h-4 ${k.color} mb-2`} />
              <p className="text-xl sm:text-2xl font-bold text-white">{loading ? '—' : k.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
            </div>
          )
        })}
      </div>

      {/* Busca */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar cliente por nome ou slug..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition" />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-900 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Nenhum cliente encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(f => {
            const st = STATUS_META[f.status || 'active'] || STATUS_META.active
            const suspended = f.status === 'suspended'
            return (
              <div key={f.id}
                className={`bg-slate-900 border rounded-xl p-4 sm:p-5 transition ${suspended ? 'border-red-500/20 opacity-70' : 'border-slate-800 hover:border-slate-700'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Identidade */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center text-xl shrink-0">
                      {segIcon(f.segment)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-white truncate">{f.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${st.cls}`}>{st.label}</span>
                        {f.plan && <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 text-slate-400 capitalize">{f.plan}</span>}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                        <span className="font-mono">/{f.slug}</span>
                        <a href={`/${f.slug}`} target="_blank" className="text-slate-600 hover:text-amber-400" onClick={e => e.stopPropagation()}>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Métricas */}
                  <div className="flex items-center gap-4 text-xs shrink-0">
                    <div className="flex items-center gap-1.5 text-slate-400"><Users className="w-3.5 h-3.5 text-slate-500" /> {f.activeUsers}/{f.users}</div>
                    <div className="flex items-center gap-1.5 text-slate-400"><FileText className="w-3.5 h-3.5 text-slate-500" /> {f.docs}</div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => enterFirm(f)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 text-xs font-semibold transition">
                      <LogIn className="w-3.5 h-3.5" /> Entrar
                    </button>
                    <button onClick={() => openEdit(f)}
                      className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition" title="Editar">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => toggleStatus(f)} disabled={busy === f.id}
                      className={`p-2 rounded-lg border transition ${suspended ? 'border-green-500/30 text-green-400 hover:bg-green-500/10' : 'border-slate-700 text-slate-500 hover:text-red-400 hover:border-red-400/30'}`}
                      title={suspended ? 'Reativar' : 'Suspender'}>
                      {busy === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Trilha de acessos (impersonation) */}
      {logs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <LogIn className="w-3.5 h-3.5" /> Acessos recentes a clientes
          </h2>
          <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
            {logs.map((l, i) => {
              const f = firms.find(x => x.id === l.firm_id)
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                  <span className="text-lg shrink-0">{segIcon(f?.segment || '')}</span>
                  <span className="text-slate-300 flex-1 truncate">{f?.name || l.firm_id}</span>
                  <span className="text-slate-500 shrink-0">
                    {new Date(l.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal de edição */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h2 className="font-semibold text-white">Editar cliente</h2>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-white transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1.5">Nome</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1.5">Slug (endereço de acesso)</label>
                <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg overflow-hidden focus-within:border-amber-500 transition">
                  <span className="text-xs text-slate-500 pl-3 font-mono">/</span>
                  <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                    className="flex-1 bg-transparent px-2 py-2.5 text-sm text-white font-mono focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1.5">Segmento</label>
                  <select value={form.segment} onChange={e => setForm(f => ({ ...f, segment: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-amber-500 transition">
                    {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1.5">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-amber-500 transition">
                    <option value="active">Ativo</option>
                    <option value="trial">Trial</option>
                    <option value="suspended">Suspenso</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1.5">Plano</label>
                <input value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
                  placeholder="Ex: free, pro, enterprise"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-800 flex gap-3">
              <button onClick={() => setEditing(null)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition">Cancelar</button>
              <button onClick={saveEdit} disabled={saving || !form.name.trim() || !form.slug.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-onaccent font-semibold py-2.5 rounded-xl text-sm transition">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
