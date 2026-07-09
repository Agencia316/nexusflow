'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { useFirm } from '@/lib/firm-context'
import { useRouter } from 'next/navigation'
import { FileText, Search, Plus, Tag, Eye, ChevronRight, BookOpen, Sparkles, Loader2 } from 'lucide-react'

const statusColors: Record<string, string> = {
  published: 'badge-success',
  draft: 'bg-slate-400/10 text-slate-400 border-slate-400/20', // slate já se re-tematiza
  archived: 'badge-warning',
}
const statusLabel: Record<string, string> = {
  published: 'Publicado', draft: 'Rascunho', archived: 'Arquivado'
}

export default function DocsPage() {
  const router = useRouter()
  const { firmId } = useFirm()
  const currentUser = getUser()
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'editor'
  const [docs, setDocs] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]|null>(null)
  const [aiEnhanced, setAiEnhanced] = useState(false)

  useEffect(() => {
    async function load() {
      const user = getUser()
      const [docsRes, catsRes, permsRes] = await Promise.all([
        supabase.from('nf_documents').select('*').eq('firm_id', firmId).order('updated_at', { ascending: false }),
        supabase.from('nf_categories').select('*').eq('firm_id', firmId).order('sort_order'),
        // Permissões individuais deste usuário (somam-se ao acesso por cargo).
        user ? supabase.from('nf_document_permissions').select('document_id').eq('user_id', user.id) : { data: [] },
      ])
      const allDocs = docsRes.data || []
      const granted = new Set((permsRes.data || []).map((p: any) => p.document_id))
      const visible = allDocs.filter((d: any) => {
        if (user?.role === 'admin') return true
        const roles = d.allowed_roles || ['admin','editor','member']
        return roles.includes(user?.role || '') || granted.has(d.id)
      })
      setDocs(visible)
      setCategories(catsRes.data || [])
      setLoading(false)
    }
    load()
  }, [firmId])

  useEffect(() => {
    if (!search.trim()) { setSearchResults(null); setAiEnhanced(false); return }
    if (search.length < 3) return
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: search, firmId })
        })
        const data = await res.json()
        setSearchResults(data.results || [])
        setAiEnhanced(!!data.aiEnhanced)
      } catch { setSearchResults(null) }
      setSearching(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [search, firmId])

  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))
  const displayDocs = searchResults !== null
    ? searchResults
    : docs.filter(d => !catFilter || d.category_id === catFilter)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Base de Conhecimento</h1>
          <p className="text-slate-400 text-sm mt-1">{docs.length} documentos · {docs.filter(d => d.status === 'published').length} publicados</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push('/app/templates')}
            className="flex items-center gap-2 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white px-4 py-2 rounded-lg transition text-sm">
            Modelos
          </button>
          {canEdit && (
          <button onClick={() => router.push('/app/docs/new')}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-onaccent font-semibold px-4 py-2 rounded-lg transition text-sm">
            <Plus className="w-4 h-4"/> Novo Documento
          </button>
          )}
        </div>
      </div>

      {/* Busca semântica */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Busca inteligente — ex: 'como qualificar lead', 'documentos B-94'..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-10 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"/>
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-amber-400"/>}
        </div>
        {!search && (
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none focus:border-amber-500 transition appearance-none">
            <option value="">Todas as categorias</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        )}
      </div>

      {/* Badge resultado da busca */}
      {search && searchResults !== null && (
        <div className="flex items-center gap-2 mb-4 text-xs flex-wrap">
          {aiEnhanced && <span className="flex items-center gap-1 text-purple-400 bg-purple-400/10 border border-purple-400/20 px-2.5 py-1 rounded-full"><Sparkles className="w-3 h-3"/> Busca aprimorada por IA</span>}
          <span className="text-slate-500">{searchResults.length} resultado{searchResults.length !== 1?'s':''} para &quot;{search}&quot;</span>
          <button onClick={() => setSearch('')} className="text-slate-600 hover:text-slate-400 ml-auto">× Limpar</button>
        </div>
      )}

      {/* Categoria pills (sem busca) */}
      {!search && (
        <div className="flex gap-2 mb-5 flex-wrap">
          <button onClick={() => setCatFilter('')} className={`px-3 py-1 rounded-full text-xs font-medium border transition ${!catFilter?'bg-amber-500/15 text-amber-400 border-amber-500/30':'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600'}`}>
            Todos
          </button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setCatFilter(catFilter===c.id?'':c.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition ${catFilter===c.id?'bg-amber-500/15 text-amber-400 border-amber-500/30':'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600'}`}>
              {c.icon} {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i=><div key={i} className="h-20 bg-slate-900 rounded-xl animate-pulse"/>)}</div>
      ) : displayDocs.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20"/>
          <p className="text-sm">{search?'Nenhum resultado encontrado.':'Nenhum documento encontrado.'}</p>
          {search && <p className="text-xs mt-1">Tente palavras diferentes ou mais gerais.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {displayDocs.map((doc: any) => {
            const cat = catMap[doc.category_id]
            return (
              <button key={doc.id} onClick={() => router.push(`/app/docs/${doc.id}`)}
                className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 text-left flex items-center gap-4 group transition">
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-lg shrink-0">
                  {cat?.icon||'📄'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-sm font-medium text-white group-hover:text-amber-300 truncate transition">{doc.title}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${statusColors[doc.status]}`}>
                      {statusLabel[doc.status]}
                    </span>
                  </div>
                  {doc.snippet && <p className="text-xs text-slate-500 truncate mb-1">{doc.snippet}</p>}
                  <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    {cat && <span>{cat.name}</span>}
                    {doc.tags?.slice(0,3).map((t: string) => (
                      <span key={t} className="flex items-center gap-1"><Tag className="w-2.5 h-2.5"/>{t}</span>
                    ))}
                    <span className="flex items-center gap-1 ml-auto"><Eye className="w-3 h-3"/>{doc.view_count||0}</span>
                    {doc.requires_signature && <span className="text-amber-500">✍️</span>}
                    {doc.requires_reading && <span className="text-blue-400">📖</span>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 shrink-0"/>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
