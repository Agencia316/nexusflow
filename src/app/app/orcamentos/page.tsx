'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { useFirm } from '@/lib/firm-context'
import {
  ClipboardList, Trash2, Search, Sun, TrendingUp, CheckCircle2,
  MessageCircle, Users, Eye, X, LayoutGrid, List,
} from 'lucide-react'

interface Quote {
  id: string
  created_at: string
  created_by_name: string | null
  cliente_nome: string | null
  cliente_zap: string | null
  cliente_cidade: string | null
  regiao: string | null
  painel: string | null
  inversor: string | null
  kwp: number | null
  n_paineis: number | null
  investimento: number | null
  economia_mes: number | null
  payback_anos: number | null
  status: string
}

const STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  novo:       { label: 'Novo',       cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30', dot: 'bg-slate-400' },
  enviado:    { label: 'Enviado',    cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30',    dot: 'bg-blue-400' },
  negociando: { label: 'Negociando', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  fechado:    { label: 'Fechado',    cls: 'bg-green-500/15 text-green-400 border-green-500/30', dot: 'bg-green-400' },
  perdido:    { label: 'Perdido',    cls: 'bg-red-500/15 text-red-400 border-red-500/30',       dot: 'bg-red-400' },
}
const STAGES = Object.keys(STATUS)

const BRL = (n: number | null) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const zapLink = (q: Quote) => {
  const n = (q.cliente_zap || '').replace(/\D/g, '')
  return n ? `https://wa.me/${n.length <= 11 ? '55' + n : n}` : null
}

export default function OrcamentosPage() {
  const user = getUser()
  const { firmId } = useFirm()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'kanban' | 'lista'>('kanban')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [viewId, setViewId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<string | null>(null)

  // Recarrega ao trocar de firma (impersonation); load só lê firmId.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (firmId) load() }, [firmId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('nf_solar_quotes')
      .select('*')
      .eq('firm_id', firmId)
      .order('created_at', { ascending: false })
    setQuotes((data as Quote[]) || [])
    setLoading(false)
  }

  async function setStatus(id: string, status: string) {
    const before = quotes
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, status } : q))
    const { error } = await supabase.from('nf_solar_quotes').update({ status }).eq('id', id)
    if (error) setQuotes(before) // desfaz o otimismo se o banco recusou
  }

  async function remove(id: string) {
    await supabase.from('nf_solar_quotes').delete().eq('id', id)
    setQuotes(prev => prev.filter(q => q.id !== id))
    setDeleteId(null)
  }

  function onDrop(stage: string) {
    if (dragId) {
      const q = quotes.find(x => x.id === dragId)
      if (q && q.status !== stage) setStatus(dragId, stage)
    }
    setDragId(null)
    setOverStage(null)
  }

  const visible = quotes.filter(q => {
    if (!search) return true
    const s = search.toLowerCase()
    return (q.cliente_nome || '').toLowerCase().includes(s) || (q.cliente_cidade || '').toLowerCase().includes(s)
  })

  const totalPipeline = quotes.filter(q => q.status !== 'perdido' && q.status !== 'fechado').reduce((a, q) => a + (q.investimento || 0), 0)
  const fechados = quotes.filter(q => q.status === 'fechado')
  const totalFechado = fechados.reduce((a, q) => a + (q.investimento || 0), 0)

  const Card = ({ q, draggable }: { q: Quote; draggable: boolean }) => {
    const zap = zapLink(q)
    return (
      <div
        draggable={draggable}
        onDragStart={() => setDragId(q.id)}
        onDragEnd={() => { setDragId(null); setOverStage(null) }}
        className={`bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-3 transition ${
          draggable ? 'cursor-grab active:cursor-grabbing' : ''
        } ${dragId === q.id ? 'opacity-40' : ''}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{q.cliente_nome || 'Sem nome'}</h3>
            {q.cliente_cidade && <p className="text-[11px] text-slate-500">{q.cliente_cidade}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setViewId(q.id)} title="Ver proposta"
              className="p-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-amber-400 hover:border-amber-400/30 transition">
              <Eye className="w-3.5 h-3.5" />
            </button>
            {zap && (
              <a href={zap} target="_blank" rel="noopener noreferrer" title="WhatsApp do cliente"
                className="p-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-green-400 hover:border-green-400/30 transition">
                <MessageCircle className="w-3.5 h-3.5" />
              </a>
            )}
            {user?.role === 'admin' && (
              <button onClick={() => setDeleteId(q.id)} title="Excluir"
                className="p-1.5 rounded-lg border border-slate-800 text-slate-600 hover:text-red-400 hover:border-red-400/30 transition">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-baseline justify-between mt-2">
          <span className="font-mono text-sm font-semibold text-amber-400">{BRL(q.investimento)}</span>
          <span className="text-[11px] text-slate-500">{BRL(q.economia_mes)}/mês</span>
        </div>

        <p className="text-[11px] text-slate-500 mt-1 truncate">
          {q.kwp ? `${q.kwp.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWp · ` : ''}
          {q.painel || ''}{q.inversor ? ` + ${q.inversor}` : ''}
        </p>

        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800/70">
          {/* Dropdown mantido: arrastar não funciona em tela de toque. */}
          <select value={q.status} onChange={e => setStatus(q.id, e.target.value)}
            className={`text-[11px] font-medium rounded-lg px-2 py-1 border bg-transparent focus:outline-none cursor-pointer ${STATUS[q.status]?.cls || STATUS.novo.cls}`}>
            {STAGES.map(k => <option key={k} value={k} className="bg-slate-900 text-white">{STATUS[k].label}</option>)}
          </select>
          <div className="flex items-center gap-2 ml-auto text-[10px] text-slate-600 min-w-0">
            {q.created_by_name && <span className="flex items-center gap-1 truncate"><Users className="w-3 h-3 shrink-0" />{q.created_by_name}</span>}
            <span className="shrink-0">{new Date(q.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
          <ClipboardList className="w-5 h-5 text-amber-400" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Pipeline de propostas</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">Orçamentos gerados na calculadora solar</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Propostas', value: quotes.length, icon: ClipboardList, color: 'text-amber-400' },
          { label: 'Em aberto', value: BRL(totalPipeline), icon: TrendingUp, color: 'text-blue-400' },
          { label: `Fechado (${fechados.length})`, value: BRL(totalFechado), icon: CheckCircle2, color: 'text-green-400' },
        ].map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <Icon className={`w-4 h-4 ${k.color} mb-2`} />
              <p className="text-lg sm:text-xl font-bold text-white truncate">{loading ? '—' : k.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
            </div>
          )
        })}
      </div>

      {/* Busca + alternador de visão */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente ou cidade..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition" />
        </div>
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 shrink-0">
          {([['kanban', LayoutGrid, 'Kanban'], ['lista', List, 'Lista']] as const).map(([v, Icon, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                view === v ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {STAGES.map(s => <div key={s} className="h-64 bg-slate-900 rounded-xl animate-pulse" />)}
        </div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Sun className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Nenhuma proposta salva ainda.</p>
          <p className="text-xs mt-1">Gere um orçamento em Ferramentas → Orçamento Solar e clique em “Salvar proposta”.</p>
        </div>
      ) : view === 'kanban' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-start">
          {STAGES.map(stage => {
            const cards = visible.filter(q => q.status === stage)
            const total = cards.reduce((a, q) => a + (q.investimento || 0), 0)
            return (
              <div key={stage}
                onDragOver={e => { e.preventDefault(); setOverStage(stage) }}
                onDragLeave={() => setOverStage(s => (s === stage ? null : s))}
                onDrop={() => onDrop(stage)}
                className={`rounded-xl border p-2 min-h-[7rem] transition ${
                  overStage === stage && dragId
                    ? 'border-amber-500/60 bg-amber-500/5'
                    : 'border-slate-800 bg-slate-950/40'
                }`}>
                <div className="flex items-center justify-between px-1.5 py-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS[stage].dot}`} />
                    <span className="text-xs font-semibold text-slate-300 truncate">{STATUS[stage].label}</span>
                    <span className="text-[10px] text-slate-600 shrink-0">{cards.length}</span>
                  </div>
                  {total > 0 && <span className="text-[10px] font-mono text-slate-500 shrink-0">{BRL(total)}</span>}
                </div>
                <div className="space-y-2">
                  {cards.map(q => <Card key={q.id} q={q} draggable />)}
                  {cards.length === 0 && (
                    <p className="text-[11px] text-slate-700 text-center py-6">
                      {dragId ? 'Solte aqui' : '—'}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">Nenhuma proposta com essa busca.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visible.map(q => <Card key={q.id} q={q} draggable={false} />)}
        </div>
      )}

      {/* Proposta salva — reusa a calculadora em modo leitura (?quote=<id>) */}
      {viewId && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-2 sm:p-6"
          onClick={() => setViewId(null)}>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-3xl h-[92vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
              <h3 className="text-sm font-semibold text-white">Proposta salva</h3>
              <button onClick={() => setViewId(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <iframe
              src={`/ferramentas/orcamento-solar.html?firm=${firmId}&quote=${viewId}`}
              title="Proposta salva"
              className="w-full flex-1 border-0"
              allow="clipboard-read; clipboard-write"
            />
          </div>
        </div>
      )}

      {/* Confirmar exclusão */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-white mb-2">Excluir proposta?</h3>
            <p className="text-sm text-slate-400 mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition">Cancelar</button>
              <button onClick={() => remove(deleteId)} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-semibold transition">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
