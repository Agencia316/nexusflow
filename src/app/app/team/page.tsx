'use client'
import { useEffect, useState } from 'react'
import { supabase, FIRM_ID } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import {
  Users, Plus, Trash2, Save, X, Loader2,
  Eye, EyeOff, Pencil, Shield, UserCheck, UserX,
  ChevronDown, GraduationCap
} from 'lucide-react'

const roleColors: Record<string,string> = {
  admin:  'bg-red-400/10 text-red-400 border-red-400/20',
  editor: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  member: 'bg-slate-400/10 text-slate-400 border-slate-400/20',
}
const roleLabel: Record<string,string> = { admin:'Admin', editor:'Editor', member:'Membro' }

interface FormData { name:string; email:string; password:string; role:string; job_role_id:string }
const emptyForm: FormData = { name:'', email:'', password:'', role:'member', job_role_id:'' }

export default function TeamPage() {
  const currentUser = getUser()
  const router = useRouter()
  const isAdmin = currentUser?.role === 'admin'

  const [users,    setUsers]    = useState<any[]>([])
  const [roles,    setRoles]    = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [form,     setForm]     = useState<FormData>(emptyForm)
  const [showPwd,  setShowPwd]  = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string|null>(null)

  useEffect(() => {
    if (!isAdmin) { router.push('/app/dashboard'); return }
    load()
  }, [])

  async function load() {
    const [usersRes, rolesRes] = await Promise.all([
      supabase.from('nf_users')
        .select('*, job_role:job_role_id(name, access_level)')
        .eq('firm_id', FIRM_ID)
        .order('created_at'),
      supabase.from('nf_roles')
        .select('*')
        .eq('firm_id', FIRM_ID)
        .order('sort_order'),
    ])
    setUsers(usersRes.data || [])
    setRoles(rolesRes.data || [])
    setLoading(false)
  }

  function openAdd() {
    setEditingUser(null)
    setForm(emptyForm)
    setError('')
    setShowForm(true)
  }

  function openEdit(u: any) {
    setEditingUser(u)
    setForm({ name: u.name, email: u.email, password: '', role: u.role, job_role_id: u.job_role_id || '' })
    setError('')
    setShowForm(true)
  }

  // Auto-preenche role quando cargo muda
  function handleJobRoleChange(roleId: string) {
    const selectedRole = roles.find(r => r.id === roleId)
    setForm(f => ({
      ...f,
      job_role_id: roleId,
      role: selectedRole?.access_level || f.role,
    }))
  }

  async function saveUser() {
    if (!form.name.trim() || !form.email.trim()) { setError('Nome e e-mail são obrigatórios.'); return }
    if (!editingUser && !form.password.trim()) { setError('Senha é obrigatória para novo membro.'); return }
    setSaving(true); setError('')

    try {
      if (editingUser) {
        const update: any = {
          name: form.name,
          email: form.email,
          role: form.role,
          job_role_id: form.job_role_id || null,
        }
        if (form.password.trim()) {
          const { error } = await supabase.rpc('nf_update_password', {
            p_user_id: editingUser.id, p_new_password: form.password
          })
          if (error) throw error
        }
        const { error } = await supabase.from('nf_users').update(update).eq('id', editingUser.id)
        if (error) throw error
        setSuccess('Membro atualizado.')
      } else {
        const { data: newId, error } = await supabase.rpc('nf_create_user', {
          p_firm_id: FIRM_ID, p_name: form.name, p_email: form.email,
          p_password: form.password, p_role: form.role,
          p_job_role_id: form.job_role_id || null,
        })
        if (error) throw error

        // Atribuir trilhas do cargo automaticamente
        if (form.job_role_id && newId) {
          const { data: paths } = await supabase
            .from('nf_training_paths')
            .select('id')
            .eq('firm_id', FIRM_ID)
            .eq('is_active', true)
            .contains('target_role_ids', [form.job_role_id])

          if (paths?.length) {
            for (const path of paths) {
              await supabase.from('nf_assignments').upsert({
                firm_id: FIRM_ID, user_id: newId,
                path_id: path.id, assigned_by: currentUser?.id,
              }, { onConflict: 'document_id,user_id', ignoreDuplicates: true })
            }
          }
        }
        setSuccess('Membro criado com sucesso.')
      }
      await load()
      setShowForm(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch(e: any) {
      setError(e.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(u: any) {
    await supabase.from('nf_users').update({ is_active: !u.is_active }).eq('id', u.id)
    await load()
  }

  async function deleteUser(id: string) {
    setSaving(true)
    await supabase.from('nf_user_progress').delete().eq('user_id', id)
    await supabase.from('nf_alerts').delete().eq('user_id', id)
    await supabase.from('nf_certificates').delete().eq('user_id', id)
    await supabase.from('nf_users').delete().eq('id', id)
    await load()
    setDeleteConfirm(null)
    setSaving(false)
  }

  if (loading) return <div className="p-6 text-slate-400">Carregando...</div>

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Equipe</h1>
          <p className="text-slate-400 text-sm mt-1">{users.length} membro{users.length!==1?'s':''} cadastrado{users.length!==1?'s':''}</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-xl text-sm transition">
          <Plus className="w-4 h-4"/> Adicionar membro
        </button>
      </div>

      {success && (
        <div className="mb-4 flex items-center gap-2 text-green-400 bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-3 text-sm">
          <UserCheck className="w-4 h-4"/> {success}
        </div>
      )}

      {/* Modal de confirmação exclusão */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-white mb-2">Excluir membro?</h3>
            <p className="text-sm text-slate-400 mb-5">Todo o progresso e histórico serão removidos.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition">Cancelar</button>
              <button onClick={() => deleteUser(deleteConfirm)} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-semibold transition disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto"/> : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de usuários */}
      <div className="space-y-2">
        {users.map(u => {
          const isSelf = u.id === currentUser?.id
          return (
            <div key={u.id} className={`bg-slate-900 border rounded-xl px-5 py-4 flex items-center gap-4 transition ${!u.is_active ? 'opacity-50 border-slate-800' : 'border-slate-800 hover:border-slate-700'}`}>
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                u.role === 'admin' ? 'bg-red-500/20 border border-red-500/30 text-red-400' :
                u.role === 'editor' ? 'bg-blue-500/20 border border-blue-500/30 text-blue-400' :
                'bg-slate-700 border border-slate-600 text-slate-300'}`}>
                {u.name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-white">{u.name}</p>
                  {isSelf && <span className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full">você</span>}
                  {!u.is_active && <span className="text-[10px] text-slate-500 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-full">inativo</span>}
                </div>
                <p className="text-xs text-slate-500">{u.email}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${roleColors[u.role]}`}>
                    {roleLabel[u.role]}
                  </span>
                  {u.job_role?.name && (
                    <span className="text-[10px] text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Shield className="w-2.5 h-2.5"/> {u.job_role.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Ações */}
              {!isSelf && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => toggleActive(u)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition ${
                      u.is_active
                        ? 'border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-400/30'
                        : 'border-green-500/30 text-green-400 bg-green-500/10 hover:bg-green-500/20'}`}>
                    {u.is_active ? <><UserX className="w-3.5 h-3.5"/> Desativar</> : <><UserCheck className="w-3.5 h-3.5"/> Ativar</>}
                  </button>
                  <button onClick={() => openEdit(u)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 text-xs transition">
                    <Pencil className="w-3.5 h-3.5"/> Editar
                  </button>
                  <button onClick={() => setDeleteConfirm(u.id)}
                    className="p-2 rounded-lg border border-slate-800 text-slate-600 hover:text-red-400 hover:border-red-400/30 transition">
                    <Trash2 className="w-3.5 h-3.5"/>
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Cargos disponíveis */}
      {roles.length > 0 && (
        <div className="mt-6 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-amber-400"/> Cargos da empresa
          </h3>
          <div className="flex flex-wrap gap-2">
            {roles.map(r => (
              <div key={r.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${roleColors[r.access_level]}`}>
                <Shield className="w-3 h-3"/> {r.name}
                <span className="text-[10px] opacity-60">· {roleLabel[r.access_level]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Painel lateral de criação/edição */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-end">
          <div className="w-full max-w-md h-full bg-slate-950 border-l border-slate-800 flex flex-col overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 shrink-0">
              <h2 className="font-semibold text-white">{editingUser ? 'Editar membro' : 'Novo membro'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white transition">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="flex-1 px-6 py-5 space-y-4">
              {error && (
                <div className="text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 text-sm">{error}</div>
              )}

              {/* Nome */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome completo *</label>
                <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))}
                  placeholder="Ex: João Silva"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"/>
              </div>

              {/* E-mail */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">E-mail *</label>
                <input value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))}
                  type="email" placeholder="joao@empresa.com.br"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"/>
              </div>

              {/* Senha */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  {editingUser ? 'Nova senha (deixe em branco para não alterar)' : 'Senha *'}
                </label>
                <div className="relative">
                  <input value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))}
                    type={showPwd ? 'text' : 'password'} placeholder="Mínimo 6 caracteres"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"/>
                  <button type="button" onClick={() => setShowPwd(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPwd ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              {/* Cargo */}
              {roles.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Cargo</label>
                  <select value={form.job_role_id} onChange={e => handleJobRoleChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition">
                    <option value="">— Sem cargo definido —</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name} · {roleLabel[r.access_level]}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-600 mt-1">O nível de acesso é preenchido automaticamente pelo cargo</p>
                </div>
              )}

              {/* Nível de acesso */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nível de acesso</label>
                <div className="flex gap-2">
                  {(['member','editor','admin'] as const).map(r => (
                    <button key={r} type="button"
                      onClick={() => setForm(f=>({...f,role:r}))}
                      className={`flex-1 py-2 rounded-xl border text-xs font-medium transition ${
                        form.role === r ? roleColors[r] : 'border-slate-800 text-slate-600 hover:border-slate-700'}`}>
                      {roleLabel[r]}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-600 mt-1.5">Membro: só lê · Editor: cria/edita · Admin: controle total</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-800 flex gap-3 shrink-0">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition">
                Cancelar
              </button>
              <button onClick={saveUser} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold py-2.5 rounded-xl text-sm transition">
                {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                {editingUser ? 'Salvar' : 'Criar membro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
