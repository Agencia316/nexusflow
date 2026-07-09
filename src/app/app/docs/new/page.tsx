'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { useFirm } from '@/lib/firm-context'
import { useRouter } from 'next/navigation'
import { getToken } from '@/lib/session'
import {
  Sparkles, Save, ArrowLeft, Loader2, Tag, X,
  Upload, FileText, AlertCircle, Eye, EyeOff, Library
} from 'lucide-react'

type Mode = 'manual' | 'ai' | 'import' | 'template'

export default function NewDocPage() {
  const router = useRouter()
  const { firmId } = useFirm()
  const user = getUser()
  const fileRef = useRef<HTMLInputElement>(null)

  const [categories, setCategories] = useState<any[]>([])
  const [mode, setMode] = useState<Mode>('manual')

  // Form
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [requiresReading, setRequiresReading] = useState(false)
  const [requiresSignature, setRequiresSignature] = useState(false)
  const [status, setStatus] = useState('published')
  const [preview, setPreview] = useState(false)

  // IA
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  // Import
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importFile, setImportFile] = useState<File|null>(null)

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Somente admin e editor podem criar documentos
    if (user?.role === 'member') { router.push('/app/docs'); return }
    supabase.from('nf_categories').select('*').eq('firm_id', firmId)
      .order('sort_order').then(r => setCategories(r.data || []))
  }, [firmId])

  async function generateWithAI() {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setAiError('')
    try {
      const res = await fetch('/api/generate-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() || ''}` },
        body: JSON.stringify({
          prompt: aiPrompt,
          firmId,
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setAiError(data.error || 'Não foi possível gerar o documento.')
      } else {
        if (data.title) setTitle(data.title)
        if (data.content) setContent(data.content)
      }
    } catch {
      setAiError('Falha de conexão ao gerar o documento.')
    }
    setAiLoading(false)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFile(file)
    setImporting(true)
    setImportError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('firmId', firmId)
      // Sem Content-Type: o browser define sozinho o boundary do multipart.
      const res = await fetch('/api/import-doc', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken() || ''}` },
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) {
        setImportError(data.error || 'Erro ao processar o arquivo.')
      } else {
        if (data.title) setTitle(data.title)
        if (data.content) setContent(data.content)
        if (data.tags?.length) setTags(data.tags)
      }
    } catch {
      setImportError('Erro ao processar o arquivo. Tente um arquivo .txt ou .md.')
    }
    setImporting(false)
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput('')
  }

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)

    const { data, error } = await supabase.from('nf_documents').insert({
      firm_id: firmId,
      category_id: categoryId || null,
      title, content, status,
      requires_reading: requiresReading,
      requires_signature: requiresSignature,
      tags,
      created_by: user?.id,
      updated_by: user?.id,
      allowed_roles: ['admin','editor','member'],
    }).select().single()

    if (data) {
      // Salvar versão inicial
      await supabase.from('nf_document_versions').insert({
        document_id: data.id,
        content,
        version_number: 1,
        created_by: user?.id,
      })
      router.push(`/app/docs/${data.id}`)
    }
    setSaving(false)
  }

  const modeBtn = (m: Mode, label: string, Icon: any) => (
    <button onClick={() => setMode(m)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition ${
        mode === m ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
      }`}>
      <Icon className="w-4 h-4"/> {label}
    </button>
  )

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition">
          <ArrowLeft className="w-4 h-4"/>
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Novo Documento</h1>
          <p className="text-xs text-slate-400 mt-0.5">Crie manualmente, com IA ou importe um arquivo</p>
        </div>
      </div>

      {/* Seletor de modo */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {modeBtn('manual', 'Manual', FileText)}
        {modeBtn('ai', 'Gerar com IA', Sparkles)}
        {modeBtn('import', 'Importar arquivo', Upload)}
        {modeBtn('template', 'A partir de modelo', Library)}
      </div>

      {/* Modo IA */}
      {mode === 'template' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-5">
          <p className="text-xs text-slate-400 mb-3">Escolha um modelo como ponto de partida — o conteúdo será copiado e você edita antes de salvar.</p>
          <button
            onClick={() => router.push('/app/templates')}
            className="w-full flex items-center justify-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 font-medium py-3 rounded-xl text-sm transition">
            <Library className="w-4 h-4"/> Ver e usar modelos disponíveis →
          </button>
        </div>
      )}

      {mode === 'ai' && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-400"/>
            <span className="text-sm font-medium text-amber-400">Descreva o documento e a IA escreve por você</span>
          </div>
          <div className="flex gap-3">
            <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generateWithAI()}
              placeholder='Ex: "Script de qualificação para SDR — critérios J1 a J5"'
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"/>
            <button onClick={generateWithAI} disabled={aiLoading || !aiPrompt.trim()}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-onaccent font-semibold px-4 py-2 rounded-lg transition whitespace-nowrap">
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}
              {aiLoading ? 'Gerando...' : 'Gerar'}
            </button>
          </div>
          {aiError && (
            <p className="text-xs text-red-400 mt-2 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0"/> {aiError}
            </p>
          )}
          {content && !aiError && <p className="text-xs text-green-400 mt-2 flex items-center gap-1">✓ Documento gerado — revise abaixo antes de salvar</p>}
        </div>
      )}

      {/* Modo Import */}
      {mode === 'import' && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Upload className="w-4 h-4 text-blue-400"/>
            <span className="text-sm font-medium text-blue-400">Importe Word (.docx), PDF ou texto (.txt, .md)</span>
          </div>
          <input ref={fileRef} type="file" className="hidden"
            accept=".txt,.md,.pdf,.docx,.doc"
            onChange={handleImport}/>
          <div className="flex items-center gap-3">
            <button onClick={() => fileRef.current?.click()} disabled={importing}
              className="flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
              {importing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>}
              {importing ? 'Processando com IA...' : 'Selecionar arquivo'}
            </button>
            {importFile && <span className="text-xs text-slate-400">{importFile.name}</span>}
          </div>
          {importError && (
            <div className="mt-3 flex items-center gap-2 text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0"/> {importError}
            </div>
          )}
          {content && !importing && (
            <p className="text-xs text-green-400 mt-2 flex items-center gap-1">✓ Arquivo processado — revise e salve</p>
          )}
          <p className="text-xs text-slate-500 mt-3">A IA processa o arquivo e formata o conteúdo em Markdown automaticamente.</p>
        </div>
      )}

      {/* Formulário */}
      <div className="space-y-5">
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-1.5">Título *</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Nome do documento"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"/>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Categoria</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-300 focus:outline-none focus:border-amber-500 transition appearance-none">
              <option value="">Sem categoria</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-300 focus:outline-none focus:border-amber-500 transition appearance-none">
              <option value="published">Publicado</option>
              <option value="draft">Rascunho</option>
            </select>
          </div>
        </div>

        {/* Editor com preview */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-400">Conteúdo (Markdown)</label>
            <button onClick={() => setPreview(!preview)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition">
              {preview ? <EyeOff className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
              {preview ? 'Editar' : 'Preview'}
            </button>
          </div>
          {preview ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg px-6 py-4 min-h-64 prose-nexus overflow-auto">
              <div dangerouslySetInnerHTML={{ __html: content.replace(/\n/g,'<br/>') }}/>
            </div>
          ) : (
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder={'# Título\n\n## Seção\n\nConteúdo...'}
              rows={18}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition font-mono resize-none"/>
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-1.5">Tags</label>
          <div className="flex gap-2 flex-wrap mb-2">
            {tags.map(t => (
              <span key={t} className="flex items-center gap-1 text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-full">
                <Tag className="w-2.5 h-2.5"/>{t}
                <button onClick={() => setTags(tags.filter(x => x !== t))}><X className="w-3 h-3 ml-1 text-slate-500 hover:text-red-400"/></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={tagInput} onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              placeholder="Adicionar tag e pressionar Enter..."
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition flex-1 max-w-xs"/>
            <button onClick={addTag} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition">+ Tag</button>
          </div>
        </div>

        {/* Opções */}
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={requiresReading} onChange={e => setRequiresReading(e.target.checked)} className="accent-amber-500 w-4 h-4"/>
            <span className="text-sm text-slate-300">Leitura obrigatória</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={requiresSignature} onChange={e => setRequiresSignature(e.target.checked)} className="accent-amber-500 w-4 h-4"/>
            <span className="text-sm text-slate-300">Requer assinatura digital</span>
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={() => router.back()} className="px-4 py-2.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white text-sm transition">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !title.trim()}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-onaccent font-semibold px-6 py-2.5 rounded-lg transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
            {saving ? 'Salvando...' : 'Salvar Documento'}
          </button>
        </div>
      </div>
    </div>
  )
}
