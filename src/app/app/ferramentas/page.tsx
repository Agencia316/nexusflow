'use client'
import { useEffect, useState } from 'react'
import { getUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { Scale, Calculator, BookOpen, ChevronRight, ExternalLink } from 'lucide-react'

const TABS = [
  { id: 'juridico', label: 'Base Jurídica', icon: Scale, src: '/ferramentas/juridico.html', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  { id: 'calculadora', label: 'Calculadora de Benefício', icon: Calculator, src: '/ferramentas/calculadora.html', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
]

export default function FerramentasPage() {
  const router = useRouter()
  const [firmSegment, setFirmSegment] = useState('advocacia')
  const [active, setActive] = useState('juridico')

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('nf_user') || '{}')
    setFirmSegment(u.firm_segment || 'advocacia')
  }, [])

  if (firmSegment !== 'advocacia') {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center px-6">
        <div className="text-5xl mb-4">☀️</div>
        <h2 className="text-xl font-bold text-white mb-2">Ferramentas Solar</h2>
        <p className="text-slate-400 text-sm max-w-md leading-relaxed mb-6">
          Ferramentas específicas para Energia Solar em desenvolvimento. Em breve: simulador de proposta, calculadora de ROI e dashboard de instalações.
        </p>
        <button onClick={() => router.push('/app/docs')}
          className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 px-4 py-2 rounded-lg text-sm transition">
          <BookOpen className="w-4 h-4"/> Ver Base de Conhecimento
        </button>
      </div>
    )
  }

  const current = TABS.find(t => t.id === active)!

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
        <a href={current.src} target="_blank" rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition">
          <ExternalLink className="w-3.5 h-3.5"/> Abrir em nova aba
        </a>
      </div>

      {/* Conteúdo em fullscreen */}
      <div className="flex-1 relative">
        {TABS.map(tab => (
          <iframe key={tab.id} src={tab.src}
            className={`w-full h-full border-0 absolute inset-0 ${active === tab.id ? 'block' : 'hidden'}`}
            title={tab.label}
            allow="clipboard-read; clipboard-write"
          />
        ))}
      </div>
    </div>
  )
}
