'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { useFirm } from '@/lib/firm-context'
import { useRouter } from 'next/navigation'
import {
  Shield, Search, CheckCircle2, XCircle, Users,
  FileText, Loader2, ChevronDown, ChevronUp, Tag,
  Lock, Unlock, Info, Filter
} from 'lucide-react'

const roleColors: Record<string, string> = {
  admin: 'bg-red-400/10 text-red-400 border-red-400/20',
  editor: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  member: 'bg-slate-400/10 text-slate-400 border-slate-400/20',
}
const roleLabel: Record<string, string> = { admin: 'Admin', editor: 'Editor', member: 'Membro' }

type PermMode = 'role' | 'user'

export default function PermissoesPage() {
  const currentUser = getUser()
  const router = useRouter()
  const { firmId } = useFirm()
  const isAdmin = currentUser?.role === 'admin'

  const [docs, setDocs] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [userPerms, setUserPerms] = useState<Record<string, string[]>>({}) // docId -> userId[]
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [mode, setMode] = useState<PermMode>('role')
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null)
  const [success, setSuccess] = useState('')

  async function loadData() {
    const [docsRes, usersRes, catsRes] = await Promise.all([
      supabase.from('nf_documents').select('*').eq('firm_id', firmId).eq('status','published').order('created_at'),
      supabase.from('nf_users').select('*').eq('firm_id', firmId).eq('is_active', true).order('name'),
      supabase.from('nf_categories').select('*').eq('firm_id', firmId).order('sort_order'),
    ])

    // nf_document_permissions não tem firm_id: escopo vem dos documentos da firma.
    // Sem o .in(), o super-admin (que atravessa o RLS) traria as permissões de
    // todas as firmas para o navegador.
    const docIds = (docsRes.data || []).map(d => d.id)
    const permsRes = docIds.length
      ? await supabase.from('nf_document_permissions').select('document_id, user_id').in('document_id', docIds)
      : { data: [] as { document_id: string; user_id: string }[] }
    setDocs(docsRes.data || [])
    setUsers(usersRes.data || [])
    setCategories(catsRes.data || [])

    // Montar mapa docId -> [userId]
    const permsMap: Record<string, string[]> = {}
    for (const p of (permsRes.data || [])) {
      if (!permsMap[p.document_id]) permsMap[p.document_id] = []
      permsMap[p.document_id].push(p.user_id)
    }
    setUserPerms(permsMap)
    setLoading(false)
  }

  useEffect(() => {
    if (!isAdmin) { router.push('/app/dashboard'); return }
    loadData()
    // Recarrega ao trocar de firma. router/isAdmin estáveis na sessão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmId])

  // Verificar se cargo tem acesso
  function hasRoleAccess(doc: any, role: string) {
    return (doc.allowed_roles || ['admin','editor','member']).includes(role)
  }

  // Verificar se usuário específico tem acesso individual
  function hasUserAccess(docId: string, userId: string) {
    return (userPerms[docId] || []).includes(userId)
  }

  // Toggle permissão de cargo
  async function toggleRoleAccess(doc: any, role: string) {
    setSaving(doc.id + role)
    const current = doc.allowed_roles || ['admin','editor','member']
    const next = current.includes(role)
      ? current.filter((r: string) => r !== role)
      : [...current, role]

    // Admin sempre mantém acesso
    const safe = next.includes('admin') ? next : [...next, 'admin']

    await supabase.from('nf_documents').update({ allowed_roles: safe }).eq('id', doc.id)
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, allowed_roles: safe } : d))
    setSaving(null)
    flash('Permissão atualizada.')
  }

  // Toggle permissão individual de usuário
  async function toggleUserAccess(docId: string, userId: string) {
    setSaving(docId + userId)
    const has = hasUserAccess(docId, userId)
    if (has) {
      await supabase.from('nf_document_permissions')
        .delete().eq('document_id', docId).eq('user_id', userId)
      setUserPerms(prev => ({
        ...prev,
        [docId]: (prev[docId] || []).filter(u => u !== userId)
      }))
    } else {
      await supabase.from('nf_document_permissions').insert({
        document_id: docId, user_id: userId, granted_by: currentUser?.id
      })
      setUserPerms(prev => ({
        ...prev,
        [docId]: [...(prev[docId] || []), userId]
      }))
    }
    setSaving(null)
    flash('Permissão atualizada.')
  }

  // Liberar todos os docs para um usuário
  async function grantAll(userId: string) {
    setSaving('all')
    const grants = docs
      .filter(d => !hasUserAccess(d.id, userId))
      .map(d => ({ document_id: d.id, user_id: userId, granted_by: currentUser?.id }))
    if (grants.length) {
      await supabase.from('nf_document_permissions').upsert(grants, { onConflict: 'document_id,user_id' })
    }
    await loadData()
    setSaving(null)
    flash('Acesso total concedido.')
  }

  // Revogar todos os docs de um usuário
  async function revokeAll(userId: string) {
    setSaving('all')
    await supabase.from('nf_document_permissions').delete().eq('user_id', userId)
    setUserPerms(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(k => { next[k] = (next[k] || []).filter(u => u !== userId) })
      return next
    })
    setSaving(null)
    flash('Todos os acessos individuais removidos.')
  }

  function flash(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 2500)
  }

  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))
  const filteredDocs = docs.filter(d => {
    const matchSearch = !search || d.title.toLowerCase().includes(search.toLowerCase())
    const matchCat = !catFilter || d.category_id === catFilter
    return matchSearch && matchCat
  })

  const selectedUserObj = users.find(u => u.id === selectedUser)

  if (!isAdmin) return null

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-amber-400" /> Painel de Permissões
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Controle quem pode acessar cada documento — por cargo ou por usuário individual.
        </p>
      </div>

      {success && (
        <div className="mb-4 flex items-center gap-2 text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}

      {/* Modo de visualização */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1 gap-1">
          <button
            onClick={() => setMode('role')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${mode === 'role' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white'}`}
          >
            <Users className="w-4 h-4" /> Por Cargo
          </button>
          <button
            onClick={() => setMode('user')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${mode === 'user' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white'}`}
          >
            <Shield className="w-4 h-4" /> Por Usuário
          </button>
        </div>

        {mode === 'user' && (
          <select
            value={selectedUser}
            onChange={e => setSelectedUser(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none focus:border-amber-500 transition"
          >
            <option value="">Selecionar usuário...</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({roleLabel[u.role]})</option>
            ))}
          </select>
        )}

        {mode === 'user' && selectedUser && (
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => grantAll(selectedUser)}
              disabled={saving === 'all'}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-green-400/10 border border-green-400/20 text-green-400 hover:bg-green-400/20 transition"
            >
              <Unlock className="w-3.5 h-3.5" /> Liberar todos
            </button>
            <button
              onClick={() => revokeAll(selectedUser)}
              disabled={saving === 'all'}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-red-400/10 border border-red-400/20 text-red-400 hover:bg-red-400/20 transition"
            >
              <Lock className="w-3.5 h-3.5" /> Revogar todos
            </button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar documento..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
        </div>
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none focus:border-amber-500 transition"
        >
          <option value="">Todas as categorias</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </div>

      {/* Legenda modo cargo */}
      {mode === 'role' && (
        <div className="flex items-center gap-2 mb-4 text-xs text-slate-500">
          <Info className="w-3.5 h-3.5" />
          Clique nos cargos para conceder ou revogar acesso. Admin sempre tem acesso total.
        </div>
      )}

      {/* Legenda modo usuário */}
      {mode === 'user' && !selectedUser && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Selecione um usuário para gerenciar seus acessos individuais.</p>
          <p className="text-xs mt-1 text-slate-600">Permissões individuais se somam às permissões de cargo.</p>
        </div>
      )}

      {/* Lista de documentos */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-slate-900 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDocs.map(doc => {
            const cat = catMap[doc.category_id]
            const isExpanded = expandedDoc === doc.id
            const docUserPerms = userPerms[doc.id] || []
            const userHasAccess = selectedUser ? hasUserAccess(doc.id, selectedUser) : false
            const userHasRoleAccess = selectedUser
              ? hasRoleAccess(doc, users.find(u => u.id === selectedUser)?.role || '')
              : false

            return (
              <div key={doc.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                {/* Row principal */}
                <div className="flex items-center gap-4 p-4">
                  {/* Ícone categoria */}
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-base shrink-0">
                    {cat?.icon || '📄'}
                  </div>

                  {/* Título e categoria */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{doc.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {cat && <span className="text-xs text-slate-500">{cat.name}</span>}
                      {doc.tags?.slice(0,2).map((t: string) => (
                        <span key={t} className="text-[10px] bg-slate-800 border border-slate-700 text-slate-500 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <Tag className="w-2 h-2" />{t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Permissões por cargo */}
                  {mode === 'role' && (
                    <div className="flex items-center gap-2 shrink-0">
                      {['admin','editor','member'].map(role => {
                        const has = hasRoleAccess(doc, role)
                        const isLocked = role === 'admin'
                        const isSaving = saving === doc.id + role
                        return (
                          <button
                            key={role}
                            onClick={() => !isLocked && toggleRoleAccess(doc, role)}
                            disabled={isLocked || !!isSaving}
                            title={isLocked ? 'Admin sempre tem acesso' : (has ? 'Revogar acesso' : 'Conceder acesso')}
                            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition ${
                              isLocked
                                ? 'bg-red-400/10 text-red-400 border-red-400/20 cursor-not-allowed opacity-70'
                                : has
                                  ? 'bg-green-400/10 text-green-400 border-green-400/20 hover:bg-green-400/20'
                                  : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-500 hover:text-slate-300'
                            }`}
                          >
                            {isSaving
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : has
                                ? <CheckCircle2 className="w-3 h-3" />
                                : <XCircle className="w-3 h-3" />
                            }
                            {roleLabel[role]}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Permissão por usuário selecionado */}
                  {mode === 'user' && selectedUser && (
                    <div className="flex items-center gap-3 shrink-0">
                      {userHasRoleAccess && (
                        <span className="text-xs text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-1 rounded-lg">
                          Acesso por cargo
                        </span>
                      )}
                      <button
                        onClick={() => toggleUserAccess(doc.id, selectedUser)}
                        disabled={saving === doc.id + selectedUser}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                          userHasAccess
                            ? 'bg-green-400/10 text-green-400 border-green-400/20 hover:bg-red-400/10 hover:text-red-400 hover:border-red-400/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/30'
                        }`}
                      >
                        {saving === doc.id + selectedUser
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : userHasAccess
                            ? <><Unlock className="w-3 h-3" /> Acesso individual</>
                            : <><Lock className="w-3 h-3" /> Sem acesso individual</>
                        }
                      </button>
                    </div>
                  )}

                  {/* Expander (modo usuário, sem seleção) */}
                  {mode === 'user' && !selectedUser && (
                    <button
                      onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </div>

                {/* Expandido: lista de usuários com acesso individual (modo user, sem seleção) */}
                {mode === 'user' && !selectedUser && isExpanded && (
                  <div className="border-t border-slate-800 px-4 py-3 bg-slate-950/50">
                    <p className="text-xs text-slate-500 mb-2 font-medium">Acessos individuais concedidos:</p>
                    {docUserPerms.length === 0 ? (
                      <p className="text-xs text-slate-600">Nenhum acesso individual. Acesso via cargo.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {docUserPerms.map(uid => {
                          const u = users.find(x => x.id === uid)
                          if (!u) return null
                          return (
                            <div key={uid} className="flex items-center gap-1.5 text-xs bg-green-400/10 border border-green-400/20 text-green-400 px-2.5 py-1 rounded-full">
                              <CheckCircle2 className="w-3 h-3" />
                              {u.name}
                              <button
                                onClick={() => toggleUserAccess(doc.id, uid)}
                                className="ml-1 text-green-400/50 hover:text-red-400 transition"
                              >×</button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Resumo estatístico */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total de documentos', value: docs.length, icon: FileText, color: 'text-blue-400' },
          { label: 'Restritos (não member)', value: docs.filter(d => !hasRoleAccess(d, 'member')).length, icon: Lock, color: 'text-amber-400' },
          { label: 'Apenas Admin/Editor', value: docs.filter(d => !hasRoleAccess(d, 'member') && hasRoleAccess(d, 'editor')).length, icon: Shield, color: 'text-red-400' },
          { label: 'Acessos individuais', value: Object.values(userPerms).reduce((acc, arr) => acc + arr.length, 0), icon: Users, color: 'text-green-400' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <Icon className={`w-4 h-4 ${s.color} mb-2`} />
              <p className="text-xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
