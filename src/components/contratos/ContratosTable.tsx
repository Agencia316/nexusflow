'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, Calendar, Phone, Mail, Tag, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import type { NfContrato } from '@/types/contratos'

const CATEGORIAS = ['Geral', 'Auxílio Acidente', 'Auxílio Doença', 'Aposentadoria']

const tipoLabel: Record<string, string> = {
  contrato: 'Contrato',
  procuracao: 'Procuração',
}

const tipoColor: Record<string, string> = {
  contrato: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  procuracao: 'bg-purple-400/10 text-purple-400 border-purple-400/20',
}

interface Props {
  contratos: NfContrato[]
  loading: boolean
  onUpdate: (id: number, patch: Partial<NfContrato>) => Promise<void>
}

export default function ContratosTable({ contratos, loading, onUpdate }: Props) {
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const filtered = contratos.filter(c => {
    const matchSearch = !search ||
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      (c.telefone || '').includes(search) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase())
    const matchTipo = !filterTipo || c.tipo === filterTipo
    const matchCat = !filterCat || c.categoria === filterCat
    return matchSearch && matchTipo && matchCat
  })

  async function toggleBool(id: number, field: 'doc_juntado' | 'pericia_marcada', current: boolean) {
    setSaving(`${id}-${field}`)
    await onUpdate(id, { [field]: !current })
    setSaving(null)
  }

  async function saveObs(id: number, obs: string) {
    setSaving(`${id}-obs`)
    await onUpdate(id, { observacao: obs })
    setSaving(null)
  }

  async function saveCat(id: number, cat: string) {
    setSaving(`${id}-cat`)
    await onUpdate(id, { categoria: cat })
    setSaving(null)
  }

  async function savePericia(id: number, date: string) {
    setSaving(`${id}-pericia`)
    await onUpdate(id, { pericia_data: date || null })
    setSaving(null)
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-16 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (contratos.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
        <p className="text-slate-500 text-sm">Nenhum contrato. Clique em "Sincronizar ZapSign" para importar.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, e-mail ou telefone…"
          className="flex-1 min-w-48 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
        />
        <select
          value={filterTipo}
          onChange={e => setFilterTipo(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-amber-500 transition"
        >
          <option value="">Todos os tipos</option>
          <option value="contrato">Contrato</option>
          <option value="procuracao">Procuração</option>
        </select>
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-amber-500 transition"
        >
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Contador */}
      {(search || filterTipo || filterCat) && (
        <p className="text-xs text-slate-500">
          {filtered.length} de {contratos.length} contrato{contratos.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Lista */}
      <div className="space-y-2">
        {filtered.map(c => {
          const isExpanded = expandedId === c.id
          return (
            <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {/* Linha principal */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Nome + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white truncate">{c.nome}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${tipoColor[c.tipo]}`}>
                      {tipoLabel[c.tipo]}
                    </span>
                    {c.categoria && c.categoria !== 'Geral' && (
                      <span className="text-[10px] text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5" />{c.categoria}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {c.data_assinatura && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(c.data_assinatura + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    {c.telefone && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />{c.telefone}
                      </span>
                    )}
                    {c.email && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Mail className="w-3 h-3" />{c.email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => toggleBool(c.id, 'doc_juntado', c.doc_juntado)}
                    disabled={saving === `${c.id}-doc_juntado`}
                    title={c.doc_juntado ? 'Doc juntado' : 'Doc pendente'}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition ${
                      c.doc_juntado
                        ? 'bg-green-400/10 text-green-400 border-green-400/20 hover:bg-red-400/10 hover:text-red-400 hover:border-red-400/20'
                        : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-amber-500/30 hover:text-amber-400'
                    }`}
                  >
                    {saving === `${c.id}-doc_juntado`
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : c.doc_juntado
                        ? <CheckCircle2 className="w-3 h-3" />
                        : <Circle className="w-3 h-3" />
                    }
                    Doc
                  </button>

                  <button
                    onClick={() => toggleBool(c.id, 'pericia_marcada', c.pericia_marcada)}
                    disabled={saving === `${c.id}-pericia_marcada`}
                    title={c.pericia_marcada ? 'Perícia marcada' : 'Perícia pendente'}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition ${
                      c.pericia_marcada
                        ? 'bg-green-400/10 text-green-400 border-green-400/20 hover:bg-red-400/10 hover:text-red-400 hover:border-red-400/20'
                        : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-amber-500/30 hover:text-amber-400'
                    }`}
                  >
                    {saving === `${c.id}-pericia_marcada`
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : c.pericia_marcada
                        ? <CheckCircle2 className="w-3 h-3" />
                        : <Circle className="w-3 h-3" />
                    }
                    Perícia
                  </button>
                </div>

                {/* Expandir */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition shrink-0"
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Painel expandido */}
              {isExpanded && (
                <div className="border-t border-slate-800 px-4 py-4 bg-slate-950/50 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Categoria */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-400">Categoria</label>
                      <select
                        defaultValue={c.categoria || 'Geral'}
                        onBlur={e => saveCat(c.id, e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition"
                      >
                        {CATEGORIAS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>

                    {/* Data de perícia */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-400">Data da Perícia</label>
                      <input
                        type="date"
                        defaultValue={c.pericia_data || ''}
                        onBlur={e => savePericia(c.id, e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition"
                      />
                    </div>
                  </div>

                  {/* Observação */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">Observação</label>
                    <textarea
                      defaultValue={c.observacao || ''}
                      onBlur={e => saveObs(c.id, e.target.value)}
                      rows={2}
                      placeholder="Anotações sobre este contrato…"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition resize-none"
                    />
                    {saving === `${c.id}-obs` && (
                      <p className="text-xs text-amber-400 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Salvando…
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
