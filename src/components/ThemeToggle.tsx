'use client'
import { useEffect, useState } from 'react'
import { Monitor, Sun, Moon } from 'lucide-react'

type Theme = 'system' | 'light' | 'dark'

const OPTIONS: { value: Theme; icon: typeof Monitor; label: string }[] = [
  { value: 'system', icon: Monitor, label: 'Automático (segue o dispositivo)' },
  { value: 'light', icon: Sun, label: 'Claro' },
  { value: 'dark', icon: Moon, label: 'Escuro' },
]

/** Aplica o tema no <html>. 'system' remove o atributo e deixa o
 *  prefers-color-scheme (resolvido no CSS) decidir. */
function applyTheme(t: Theme) {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  if (t === 'system') el.removeAttribute('data-theme')
  else el.setAttribute('data-theme', t)
  try { localStorage.setItem('nf_theme', t) } catch {}
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('nf_theme') as Theme | null
      if (saved === 'light' || saved === 'dark' || saved === 'system') setTheme(saved)
    } catch {}
  }, [])

  function choose(t: Theme) {
    setTheme(t)
    applyTheme(t)
  }

  return (
    <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-0.5">
      {OPTIONS.map(opt => {
        const Icon = opt.icon
        const active = theme === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => choose(opt.value)}
            title={opt.label}
            aria-label={opt.label}
            aria-pressed={active}
            className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition ${
              active
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-slate-500 hover:text-slate-300 border border-transparent'
            }`}>
            <Icon className="w-3.5 h-3.5" />
          </button>
        )
      })}
    </div>
  )
}
