'use client'
import { useEffect, useState } from 'react'
import { getToken } from '@/lib/session'
import { CAMPOS_PILLAR_FIRM_ID } from '@/lib/brand'
import { Scale, Calculator, Sun, Activity, TrendingUp, ExternalLink, Loader2, AlertCircle } from 'lucide-react'

type Tab = {
  id: string
  label: string
  icon: any
  /** URL do iframe (string) ou função que injeta o firmId. */
  src: string | ((firmId: string) => string)
  color: string
  /** Carrega via endpoint autenticado (fetch + srcDoc) em vez de iframe público. */
  authed?: boolean
  /** Só aparece para esta firma (ou super admin). Omitido = todos do segmento. */
  firmId?: string
}

// Ferramentas por segmento. As abas com firmId são exclusivas daquela firma.
const TABS_BY_SEGMENT: Record<string, Tab[]> = {
  advocacia: [
    { id: 'juridico', label: 'Base Jurídica', icon: Scale, src: '/ferramentas/juridico.html', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
    { id: 'calculadora', label: 'Calculadora de Benefício', icon: Calculator, src: '/ferramentas/calculadora.html', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
    // Exclusivas da Campos Pillar (Auxílio-Acidente + marketing privado).
    { id: 'painel', label: 'Painel Auxílio-Acidente', icon: Activity, src: '/ferramentas/painel.html', color: 'text-green-400 bg-green-400/10 border-green-400/20', firmId: CAMPOS_PILLAR_FIRM_ID },
    { id: 'dashboard', label: 'Dashboard Marketing', icon: TrendingUp, src: '/api/pillar/dashboard', authed: true, color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', firmId: CAMPOS_PILLAR_FIRM_ID },
  ],
  solar: [
    { id: 'orcamento', label: 'Orçamento Solar', icon: Sun, src: (firmId: string) => `/ferramentas/orcamento-solar.html?firm=${firmId}`, color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  ],
}

/**
 * Frame de ferramenta protegida: busca o HTML no endpoint autenticado (mandando
 * o token da sessão) e injeta via srcDoc. Fica sempre montado, só escondido,
 * para preservar o estado ao trocar de aba.
 */
function AuthedFrame({ path, title, active }: { path: string; title: string; active: boolean }) {
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const token = getToken()
      try {
        const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        if (!res.ok) {
          const o = await res.json().catch(() => ({}))
          if (!cancelled) setError(o.error || 'Não foi possível carregar.')
          return
        }
        const t = await res.text()
        if (!cancelled) setHtml(t)
      } catch {
        if (!cancelled) setError('Falha de rede ao carregar.')
      }
    }
    load()
    return () => { cancelled = true }
  }, [path])

  return (
    <div className={`w-full h-full absolute inset-0 ${active ? 'block' : 'hidden'}`}>
      {error ? (
        <div className="h-full flex items-center justify-center px-4">
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0"/> {error}
          </div>
        </div>
      ) : html === null ? (
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400"/>
        </div>
      ) : (
        <iframe srcDoc={html} title={title} className="w-full h-full border-0" allow="clipboard-read; clipboard-write"/>
      )}
    </div>
  )
}

export default function FerramentasPage() {
  const [firmSegment, setFirmSegment] = useState('advocacia')
  const [firmId, setFirmId] = useState('')
  const [isSuper, setIsSuper] = useState(false)
  const [active, setActive] = useState('')

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('nf_user') || '{}')
    const seg = u.firm_segment || 'advocacia'
    const fid = localStorage.getItem('nf_firm_id') || u.firm_id || ''
    setFirmSegment(seg)
    setFirmId(fid)
    setIsSuper(!!u.is_super_admin)
    const base = TABS_BY_SEGMENT[seg] || TABS_BY_SEGMENT.advocacia
    const vis = base.filter(t => !t.firmId || t.firmId === fid || u.is_super_admin)
    setActive(vis[0]?.id || '')
  }, [])

  const allTabs = TABS_BY_SEGMENT[firmSegment] || TABS_BY_SEGMENT.advocacia
  const TABS = allTabs.filter(t => !t.firmId || t.firmId === firmId || isSuper)
  const srcOf = (t: Tab) => typeof t.src === 'function' ? t.src(firmId) : t.src

  if (!active) return null
  const current = TABS.find(t => t.id === active) || TABS[0]

  return (
    <div className="flex flex-col h-full">
      {/* Header com abas */}
      <div className="border-b border-slate-800 bg-slate-900 px-6 py-3 flex items-center gap-3 shrink-0 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = active === tab.id
          return (
            <button key={tab.id} onClick={() => setActive(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition whitespace-nowrap ${
                isActive ? tab.color : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
              }`}>
              <Icon className="w-4 h-4"/>
              {tab.label}
            </button>
          )
        })}
        {/* "Abrir em nova aba" só faz sentido para ferramentas públicas (não autenticadas). */}
        {!current.authed && (
          <a href={srcOf(current)} target="_blank" rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition shrink-0">
            <ExternalLink className="w-3.5 h-3.5"/> Abrir em nova aba
          </a>
        )}
      </div>

      {/* Conteúdo em fullscreen */}
      <div className="flex-1 relative">
        {TABS.map(tab => (
          tab.authed ? (
            <AuthedFrame key={tab.id} path={typeof tab.src === 'string' ? tab.src : tab.src(firmId)}
              title={tab.label} active={active === tab.id}/>
          ) : (
            <iframe key={tab.id} src={srcOf(tab)}
              className={`w-full h-full border-0 absolute inset-0 ${active === tab.id ? 'block' : 'hidden'}`}
              title={tab.label}
              allow="clipboard-read; clipboard-write"
            />
          )
        ))}
      </div>
    </div>
  )
}
