'use client'

import { useState } from 'react'
import {
  CheckCircle2, Circle, Calendar, Phone, Mail, Tag,
  ChevronDown, ChevronUp, Loader2, MessageCircle
} from 'lucide-react'
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

interface ClientGroup {
  nome: string
  telefone: string | null
  email: string | null
  docs: NfContrato[]
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
  const [expandedNome, setExpandedNome] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  // Agrupa contratos por nome do cliente
  const groups: ClientGroup[] = Object.values(
    contratos.reduce<Record<string, ClientGroup>>((acc, c) => {
      if (!acc[c.nome]) {
        acc[c.nome] = { nome: c.nome, telefone: c.telefone, email: c.email, docs: [] }
      }
      // Prefere telefone/email não-nulo
      if (!acc[c.nome].telefone && c.telefone) acc[c.nome].telefone = c.telefone
      if (!acc[c.nome].email && c.email) acc[c.nome].email = c.email
      acc[c.nome].docs.push(c)
      return acc
    }, {})
  )

  const filteredGroups = groups.filter(g => {
    const matchSearch = !search ||
      g.nome.toLowerCase().includes(search.toLowerCase()) ||
      (g.telefone || '').includes(search) ||
      (g.email || '').toLowerCase().includes(search.toLowerCase())
    const matchTipo = !filterTipo || g.docs.some(d => d.tipo === filterTipo)
    const matchCat = !filterCat || g.docs.some(d => d.categoria === filterCat)
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

  function buildWhatsApp(telefone: string | null) {
    if (!telefone) return null
    const digits = telefone.replace(/\D/g, '')
    if (!digits) return null
    const number = digits.startsWith('55') ? digits : `55${digits}`
    return `https://wa.me/${number}`
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
          {filteredGroups.length} de {groups.length} cliente{groups.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Lista agrupada por cliente */}
      <div className="space-y-2">
        {filteredGroups.map(g => {
          const isExpanded = expandedNome === g.nome
          const waLink = buildWhatsApp(g.telefone)

          return (
            <div key={g.nome} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {/* Linha principal */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Nome + documentos concatenados */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{g.nome}</span>
                    {/* Badges dos documentos concatenados */}
                    {g.docs.map(doc => (
                      <span
                        key={doc.id}
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${tipoColor[doc.tipo]}`}
                      >
                        {tipoLabel[doc.tipo]}
                      </span>
                    ))}
                    {/* Categorias únicas */}
                    {[...new Set(g.docs.map(d => d.categoria).filter((c): c is string => c !== null))].map(cat => (
                      cat !== 'Geral' && (
                        <span key={cat} className="text-[10px] text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Tag className="w-2.5 h-2.5" />{cat}
                        </span>
                      )
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {/* Data mais recente */}
                    {g.docs[0]?.data_assinatura && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(g.docs[0].data_assinatura + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    {g.telefone && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />{g.telefone}
                      </span>
                    )}
                    {g.email && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Mail className="w-3 h-3" />{g.email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Botão WhatsApp */}
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir no WhatsApp"
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border bg-green-400/10 text-green-400 border-green-400/20 hover:bg-green-400/20 transition shrink-0"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
                  </a>
                )}

                {/* Expandir */}
                <button
                  onClick={() => setExpandedNome(isExpanded ? null : g.nome)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition shrink-0"
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Painel expandido — um bloco por documento */}
              {isExpanded && (
                <div className="border-t border-slate-800 px-4 py-4 bg-slate-950/50 space-y-5">
                  {g.docs.map((doc, idx) => (
                    <div key={doc.id} className={idx > 0 ? 'border-t border-slate-800 pt-5' : ''}>
                      {/* Título do documento */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tipoColor[doc.tipo]}`}>
                          {tipoLabel[doc.tipo]}
                        </span>
                        {/* Toggles por documento */}
                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            onClick={() => toggleBool(doc.id, 'doc_juntado', doc.doc_juntado)}
                            disabled={saving === `${doc.id}-doc_juntado`}
                            title={doc.doc_juntado ? 'Doc juntado' : 'Doc pendente'}
                            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition ${
                              doc.doc_juntado
                                ? 'bg-green-400/10 text-green-400 border-green-400/20 hover:bg-red-400/10 hover:text-red-400 hover:border-red-400/20'
                                : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-amber-500/30 hover:text-amber-400'
                            }`}
                          >
                            {saving === `${doc.id}-doc_juntado`
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : doc.doc_juntado
                                ? <CheckCircle2 className="w-3 h-3" />
                                : <Circle className="w-3 h-3" />
                            }
                            Doc
                          </button>

                          <button
                            onClick={() => toggleBool(doc.id, 'pericia_marcada', doc.pericia_marcada)}
                            disabled={saving === `${doc.id}-pericia_marcada`}
                            title={doc.pericia_marcada ? 'Perícia marcada' : 'Perícia pendente'}
                            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition ${
                              doc.pericia_marcada
                                ? 'bg-green-400/10 text-green-400 border-green-400/20 hover:bg-red-400/10 hover:text-red-400 hover:border-red-400/20'
                                : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-amber-500/30 hover:text-amber-400'
                            }`}
                          >
                            {saving === `${doc.id}-pericia_marcada`
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : doc.pericia_marcada
                                ? <CheckCircle2 className="w-3 h-3" />
                                : <Circle className="w-3 h-3" />
                            }
                            Perícia
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Categoria */}
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-400">Categoria</label>
                          <select
                            defaultValue={doc.categoria || 'Geral'}
                            onBlur={e => saveCat(doc.id, e.target.value)}
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
                            defaultValue={doc.pericia_data || ''}
                            onBlur={e => savePericia(doc.id, e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition"
                          />
                        </div>
                      </div>

                      {/* Observação */}
                      <div className="space-y-1 mt-4">
                        <label className="text-xs font-medium text-slate-400">Observação</label>
                        <textarea
                          defaultValue={doc.observacao || ''}
                          onBlur={e => saveObs(doc.id, e.target.value)}
                          rows={2}
                          placeholder="Anotações sobre este documento…"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition resize-none"
                        />
                        {saving === `${doc.id}-obs` && (
                          <p className="text-xs text-amber-400 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Salvando…
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
