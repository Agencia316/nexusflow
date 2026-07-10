'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { useFirm } from '@/lib/firm-context'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Save, Loader2, CheckCircle2, History,
  Eye, EyeOff, Tag, X, Plus, AlertCircle, RotateCcw
} from 'lucide-react'

const STATUS_OPTS = [
  { value: 'published', label: 'Publicado', color: 'text-green-400' },
  { value: 'draft', label: 'Rascunho', color: 'text-slate-400' },
  { value: 'archived', label: 'Arquivado', color: 'text-orange-400' },
]

export default function EditDocPage() {
  const { id } = useParams()
  const router = useRouter()
  const { firmId } = useFirm()
  const user = getUser()

  const [doc, setDoc] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [versions, setVersions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [showVersions, setShowVersions] = useState(false)
  const [preview, setPreview] = useState(false)
  const [newTag, setNewTag] = useState('')

  // Form state
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState('published')
  const [categoryId, setCategoryId] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [requiresReading, setRequiresReading] = useState(false)
  const [requiresSignature, setRequiresSignature] = useState(false)
  const [allowedRoles, setAllowedRoles] = useState<string[]>(['admin','editor','member'])

  useEffect(() => {
    if (user?.role === 'member') { router.push(`/app/docs/${id}`); return }
    load()
    // Recarrega ao mudar doc/firma. router estável; user?.role fixo na sessão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, firmId])

  async function load() {
    const [docRes, catsRes, versRes] = await Promise.all([
      supabase.from('nf_documents').select('*').eq('id', id).single(),
      supabase.from('nf_categories').select('*').eq('firm_id', firmId).order('sort_order'),
      supabase.from('nf_document_versions').select('*').eq('document_id', id).order('created_at', { ascending: false }).limit(10),
    ])
    if (docRes.data) {
      const d = docRes.data
      setDoc(d)
      setTitle(d.title || '')
      setContent(d.content || '')
      setStatus(d.status || 'published')
      setCategoryId(d.category_id || '')
      setTags(d.tags || [])
      setRequiresReading(d.requires_reading || false)
      setRequiresSignature(d.requires_signature || false)
      setAllowedRoles(d.allowed_roles || ['admin','editor','member'])
    }
    setCategories(catsRes.data || [])
    setVersions(versRes.data || [])
    setLoading(false)
  }

  async function save() {
    if (!title.trim()) { setError('O título é obrigatório.'); return }
    setSaving(true); setError(''); setSaved(false)

    // Salvar versão anterior
    if (doc?.content) {
      await supabase.from('nf_document_versions').insert({
        document_id: id, content: doc.content,
        title: doc.title, created_by: user?.id,
        version_note: `Versão antes da edição por ${user?.name}`,
      })
    }

    const { error: err } = await supabase.from('nf_documents').update({
      title, content, status,
      category_id: categoryId || null,
      tags, requires_reading: requiresReading,
      requires_signature: requiresSignature,
      allowed_roles: allowedRoles,
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    if (err) { setError(err.message); setSaving(false); return }

    setSaved(true)
    setDoc((prev: any) => ({ ...prev, title, content }))
    setTimeout(() => setSaved(false), 3000)
    await load()
    setSaving(false)
  }

  async function restoreVersion(v: any) {
    if (!confirm('Restaurar esta versão? O conteúdo atual será salvo como nova versão.')) return
    setContent(v.content)
    setTitle(v.title || title)
  }

  function addTag() {
    const t = newTag.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setNewTag('')
  }

  function toggleRole(role: string) {
    setAllowedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-5 h-5 animate-spin text-amber-400"/>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b border-slate-800 bg-slate-900 px-6 py-3 flex items-center gap-3 shrink-0 flex-wrap">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition">
          <ArrowLeft className="w-4 h-4"/>
        </button>
        <span className="text-sm text-slate-400 truncate flex-1 min-w-0">{title || 'Sem título'}</span>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowVersions(!showVersions)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 px-3 py-1.5 rounded-lg transition">
            <History className="w-3.5 h-3.5"/> Versões ({versions.length})
          </button>
          <button onClick={() => setPreview(!preview)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 px-3 py-1.5 rounded-lg transition">
            {preview ? <EyeOff className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
            {preview ? 'Editar' : 'Preview'}
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-onaccent font-semibold text-xs px-4 py-1.5 rounded-lg transition">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> :
             saved ? <><CheckCircle2 className="w-3.5 h-3.5"/> Salvo!</> :
             <><Save className="w-3.5 h-3.5"/> Salvar</>}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Editor principal */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0"/> {error}
            </div>
          )}

          {/* Título */}
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Título do documento"
            className="w-full bg-transparent text-2xl font-bold text-white placeholder-slate-600 border-none outline-none mb-6 resize-none"/>

          {/* Conteúdo */}
          {preview ? (
            <div className="prose-nexus bg-slate-900 border border-slate-800 rounded-xl p-6 min-h-96">
              <div dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br>') }}/>
            </div>
          ) : (
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder="Escreva o conteúdo em Markdown...

# Título principal
## Subtítulo

Texto normal, **negrito**, *itálico*

- Item de lista
- Outro item

| Coluna 1 | Coluna 2 |
|---|---|
| Dado | Dado |"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-6 text-sm text-slate-300 placeholder-slate-600 font-mono focus:outline-none focus:border-amber-500 transition resize-none min-h-96 leading-relaxed"
              style={{ minHeight: '500px' }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = 'auto'
                t.style.height = t.scrollHeight + 'px'
              }}
            />
          )}
        </div>

        {/* Painel lateral de configurações */}
        <div className="w-72 border-l border-slate-800 bg-slate-900/50 overflow-y-auto p-4 shrink-0 space-y-5">

          {/* Status */}
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-2">Status</label>
            <div className="space-y-1">
              {STATUS_OPTS.map(s => (
                <button key={s.value} onClick={() => setStatus(s.value)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition ${
                    status === s.value ? 'bg-slate-800 border-slate-600' : 'border-transparent hover:bg-slate-800'
                  }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    s.value === 'published' ? 'bg-green-400' :
                    s.value === 'draft' ? 'bg-slate-400' : 'bg-orange-400'
                  }`}/>
                  <span className={s.color}>{s.label}</span>
                  {status === s.value && <CheckCircle2 className="w-3 h-3 text-amber-400 ml-auto"/>}
                </button>
              ))}
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-2">Categoria</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500 transition">
              <option value="">Sem categoria</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-2">Tags</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map(t => (
                <span key={t} className="flex items-center gap-1 text-[10px] bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
                  {t}
                  <button onClick={() => setTags(prev => prev.filter(x => x !== t))} className="hover:text-red-400">
                    <X className="w-2.5 h-2.5"/>
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input value={newTag} onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
                placeholder="Nova tag..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"/>
              <button onClick={addTag} className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg hover:border-slate-600 text-slate-400 hover:text-white transition">
                <Plus className="w-3.5 h-3.5"/>
              </button>
            </div>
          </div>

          {/* Configurações */}
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-2">Configurações</label>
            <div className="space-y-2">
              {[
                { label: 'Leitura obrigatória', value: requiresReading, set: setRequiresReading },
                { label: 'Assinatura obrigatória', value: requiresSignature, set: setRequiresSignature },
              ].map(item => (
                <button key={item.label} onClick={() => item.set(!item.value)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition ${
                    item.value ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}>
                  {item.label}
                  <div className={`w-8 h-4 rounded-full transition ${item.value ? 'bg-amber-500' : 'bg-slate-600'} relative`}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${item.value ? 'left-4' : 'left-0.5'}`}/>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Visibilidade por cargo */}
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-2">Visível para</label>
            <div className="space-y-1">
              {[
                { role: 'admin', label: 'Admin' },
                { role: 'editor', label: 'Editor' },
                { role: 'member', label: 'Membro' },
              ].map(r => (
                <button key={r.role} onClick={() => toggleRole(r.role)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition ${
                    allowedRoles.includes(r.role) ? 'bg-slate-800 border-slate-600 text-white' : 'border-slate-800 text-slate-600'
                  }`}>
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                    allowedRoles.includes(r.role) ? 'bg-amber-500 border-amber-500' : 'border-slate-600'
                  }`}>
                    {allowedRoles.includes(r.role) && <CheckCircle2 className="w-2.5 h-2.5 text-white"/>}
                  </div>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Histórico de versões */}
          {showVersions && versions.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-2">Histórico de versões</label>
              <div className="space-y-2">
                {versions.map(v => (
                  <div key={v.id} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5">
                    <p className="text-[10px] text-slate-500 mb-1">
                      {new Date(v.created_at).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                    </p>
                    <p className="text-xs text-slate-400 truncate mb-2">{v.version_note || 'Versão anterior'}</p>
                    <button onClick={() => restoreVersion(v)}
                      className="flex items-center gap-1 text-[10px] text-amber-400 hover:underline">
                      <RotateCcw className="w-2.5 h-2.5"/> Restaurar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
