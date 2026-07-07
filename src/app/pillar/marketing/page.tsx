'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from '@/lib/session'
import { Loader2, AlertCircle } from 'lucide-react'

/**
 * Painel de Marketing da Campos Pillar. O HTML autocontido (Histórico Diário,
 * CPL, Meta Ads — banco próprio chxakvcpwluzzwdkwozc) não fica mais em /public:
 * é servido por /api/pillar/dashboard só com sessão válida, e injetado aqui via
 * srcDoc (iframe same-origin, então localStorage e scripts do dashboard seguem
 * funcionando igual a antes).
 */
export default function PillarMarketing() {
  const router = useRouter()
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const token = getToken()
      if (!token) { router.replace('/pillar/login'); return }
      try {
        const res = await fetch('/api/pillar/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.status === 401) { router.replace('/pillar/login'); return }
        if (!res.ok) {
          const out = await res.json().catch(() => ({}))
          if (!cancelled) setError(out.error || 'Não foi possível carregar o painel.')
          return
        }
        const text = await res.text()
        if (!cancelled) setHtml(text)
      } catch {
        if (!cancelled) setError('Falha de rede ao carregar o painel.')
      }
    }
    load()
    return () => { cancelled = true }
  }, [router])

  if (error) return (
    <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
      <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
        <AlertCircle className="w-4 h-4 shrink-0"/> {error}
      </div>
    </div>
  )

  if (html === null) return (
    <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-amber-400"/>
    </div>
  )

  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <iframe
        srcDoc={html}
        title="Dashboard de Marketing — Campos Pillar"
        className="w-full h-full border-0"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  )
}
