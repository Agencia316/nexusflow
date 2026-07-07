'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { useFirm } from '@/lib/firm-context'
import {
  ClipboardList, Loader2, Trash2, Search, Sun, TrendingUp, CheckCircle2,
  MessageCircle, Users,
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

const STATUS: Record<string, { label: string; cls: string }> = {
  novo:       { label: 'Novo',        cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  enviado:    { label: 'Enviado',     cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  negociando: { label: 'Negociando',  cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  fechado:    { label: 'Fechado',     cls: 'bg-green-500/15 text-green-400 border-green-500/30' },
  perdido:    { label: 'Perdido',     cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
}

const BRL = (n: number | null) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export default function OrcamentosPage() {
  const user = getUser()
  const { firmId } = useFirm()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

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
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, status } : q))
    await supabase.from('nf_solar_quotes').update({ status }).eq('id', id)
  }

  async function remove(id: string) {
    await supabase.from('nf_solar_quotes').delete().eq('id', id)
    setQuotes(prev => prev.filter(q => q.id !== id))
    setDeleteId(null)
  }

  const visible = quotes.filter(q => {
    if (filter && q.status !== filter) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (q.cliente_nome || '').toLowerCase().includes(s) || (q.cliente_cidade || '').toLowerCase().includes(s)
  })

  const totalPipeline = quotes.filter(q => q.status !== 'perdido').reduce((a, q) => a + (q.investimento || 0), 0)
  const fechados = quotes.filter(q => q.status === 'fechado')
  const totalFechado = fechados.reduce((a, q) => a + (q.investimento || 0), 0)

  const zapLink = (q: Quote) => {
    const n = (q.cliente_zap || '').replace(/\D/g, '')
    return n ? `https://wa.me/${n.length <= 11 ? '55' + n : n}` : null
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
          <ClipboardList className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Propostas de orçamento</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">Histórico de orçamentos gerados na calculadora solar</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Propostas', value: quotes.length, icon: ClipboardList, color: 'text-amber-400' },
          { label: 'Pipeline (ativo)', value: BRL(totalPipeline), icon: TrendingUp, color: 'text-blue-400' },
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

      {/* Busca + filtro */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente ou cidade..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-amber-500 transition">
          <option value="">Todos os status</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-900 rounded-xl animate-pulse" />)}</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Sun className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Nenhuma proposta {quotes.length ? 'com esse filtro' : 'salva ainda'}.</p>
          {!quotes.length && <p className="text-xs mt-1">Gere um orçamento em Ferramentas → Orçamento Solar e clique em “Salvar proposta”.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(q => {
            const st = STATUS[q.status] || STATUS.novo
            const zap = zapLink(q)
            return (
              <div key={q.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-white truncate">{q.cliente_nome || 'Sem nome'}</h3>
                      {q.cliente_cidade && <span className="text-xs text-slate-500">· {q.cliente_cidade}</span>}
                      {zap && (
                        <a href={zap} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300" title="WhatsApp do cliente">
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {q.kwp ? `${q.kwp.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWp · ` : ''}
                      {q.painel || ''}{q.inversor ? ` + ${q.inversor}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs shrink-0">
                    <div className="text-right">
                      <p className="font-mono font-semibold text-amber-400">{BRL(q.investimento)}</p>
                      <p className="text-slate-500">{BRL(q.economia_mes)}/mês</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select value={q.status} onChange={e => setStatus(q.id, e.target.value)}
                      className={`text-xs font-medium rounded-lg px-2.5 py-1.5 border bg-transparent focus:outline-none cursor-pointer ${st.cls}`}>
                      {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k} className="bg-slate-900 text-white">{v.label}</option>)}
                    </select>
                    {user?.role === 'admin' && (
                      <button onClick={() => setDeleteId(q.id)}
                        className="p-1.5 rounded-lg border border-slate-800 text-slate-600 hover:text-red-400 hover:border-red-400/30 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-600">
                  {q.created_by_name && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {q.created_by_name}</span>}
                  <span>{new Date(q.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  {q.payback_anos != null && <span>· payback {q.payback_anos.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} anos</span>}
                </div>
              </div>
            )
          })}
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
