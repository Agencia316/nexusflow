'use client'
import { useEffect, useRef, useState } from 'react'
import { useFirm, segmentLabel } from '@/lib/firm-context'
import { Building2, Check, ChevronDown, Eye, RotateCcw, Search } from 'lucide-react'

/**
 * Seletor de firma do super-admin ("entrar como cliente").
 * Renderiza nada para usuários comuns — a visibilidade é decidida aqui,
 * então o Sidebar pode montá-lo incondicionalmente.
 */
export default function FirmSwitcher() {
  const { firmId, firmName, firmSegment, isSuperAdmin, isImpersonating, firms, setActiveFirm, resetFirm } = useFirm()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (!isSuperAdmin) return null

  const filtered = firms.filter(f =>
    !query || f.name.toLowerCase().includes(query.toLowerCase()),
  )

  function choose(id: string) {
    setActiveFirm(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={ref} className="relative px-3 pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition ${
          isImpersonating
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600'
        }`}>
        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
          isImpersonating ? 'bg-amber-500/20' : 'bg-slate-700'
        }`}>
          {isImpersonating ? <Eye className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate leading-tight">{firmName || 'Selecionar firma'}</p>
          <p className="text-[10px] text-slate-500 truncate leading-tight capitalize">
            {isImpersonating ? 'entrando como cliente' : segmentLabel(firmSegment)}
          </p>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {isImpersonating && !open && (
        <button
          onClick={resetFirm}
          className="mt-1.5 w-full flex items-center justify-center gap-1.5 text-[10px] text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-md py-1.5 transition">
          <RotateCcw className="w-3 h-3" /> Voltar para minha firma
        </button>
      )}

      {open && (
        <div className="absolute left-3 right-3 mt-1.5 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-xl shadow-black/40 overflow-hidden">
          {/* Busca (só se houver muitas firmas) */}
          {firms.length > 6 && (
            <div className="p-2 border-b border-slate-800">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar firma..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"/>
              </div>
            </div>
          )}

          <div className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">Nenhuma firma encontrada.</p>
            ) : filtered.map(f => {
              const active = f.id === firmId
              return (
                <button
                  key={f.id}
                  onClick={() => choose(f.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition ${
                    active ? 'bg-amber-500/10' : 'hover:bg-slate-800'
                  }`}>
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs ${
                    active ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {f.segment === 'solar' ? '☀️' : '⚖️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${active ? 'text-amber-300' : 'text-slate-300'}`}>{f.name}</p>
                    <p className="text-[10px] text-slate-500 truncate capitalize">{segmentLabel(f.segment)}</p>
                  </div>
                  {active && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
