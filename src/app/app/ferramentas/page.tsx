'use client'
import { useEffect, useState } from 'react'
import { getUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { Scale, Calculator, Sun, BookOpen, ChevronRight, ExternalLink } from 'lucide-react'

// Ferramentas por segmento. O src pode ser função para injetar o firmId no iframe.
const TABS_BY_SEGMENT: Record<string, { id: string; label: string; icon: any; src: string | ((firmId: string) => string); color: string }[]> = {
  advocacia: [
    { id: 'juridico', label: 'Base Jurídica', icon: Scale, src: '/ferramentas/juridico.html', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
    { id: 'calculadora', label: 'Calculadora de Benefício', icon: Calculator, src: '/ferramentas/calculadora.html', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  ],
  solar: [
    { id: 'orcamento', label: 'Orçamento Solar', icon: Sun, src: (firmId: string) => `/ferramentas/orcamento-solar.html?firm=${firmId}`, color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  ],
}

export default function FerramentasPage() {
  const router = useRouter()
  const [firmSegment, setFirmSegment] = useState('advocacia')
  const [firmId, setFirmId] = useState('')
  const [active, setActive] = useState('')

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('nf_user') || '{}')
    const seg = u.firm_segment || 'advocacia'
    setFirmSegment(seg)
    setFirmId(localStorage.getItem('nf_firm_id') || u.firm_id || '')
    setActive((TABS_BY_SEGMENT[seg] || TABS_BY_SEGMENT.advocacia)[0].id)
  }, [])

  const TABS = TABS_BY_SEGMENT[firmSegment] || TABS_BY_SEGMENT.advocacia
  const srcOf = (t: typeof TABS[number]) => typeof t.src === 'function' ? t.src(firmId) : t.src

  if (!active) return null

  const current = TABS.find(t => t.id === active) || TABS[0]

  return (
    <div className="flex flex-col h-full">
      {/* Header com abas */}
      <div className="border-b border-slate-800 bg-slate-900 px-6 py-3 flex items-center gap-3 shrink-0">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = active === tab.id
          return (
            <button key={tab.id} onClick={() => setActive(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition ${
                isActive ? tab.color : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
              }`}>
              <Icon className="w-4 h-4"/>
              {tab.label}
            </button>
          )
        })}
        <a href={srcOf(current)} target="_blank" rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition">
          <ExternalLink className="w-3.5 h-3.5"/> Abrir em nova aba
        </a>
      </div>

      {/* Conteúdo em fullscreen */}
      <div className="flex-1 relative">
        {TABS.map(tab => (
          <iframe key={tab.id} src={srcOf(tab)}
            className={`w-full h-full border-0 absolute inset-0 ${active === tab.id ? 'block' : 'hidden'}`}
            title={tab.label}
            allow="clipboard-read; clipboard-write"
          />
        ))}
      </div>
    </div>
  )
}
