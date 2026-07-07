'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getUser, logout } from '@/lib/auth'
import { isSessionExpired } from '@/lib/session'
import { FirmProvider } from '@/lib/firm-context'
import { BRAND, CAMPOS_PILLAR_FIRM_ID } from '@/lib/brand'
import { Scale, LayoutDashboard, TrendingUp, LogOut } from 'lucide-react'

/** true quando o usuário pode acessar o produto Campos Pillar. */
function podeAcessar(user: { is_super_admin?: boolean; firm_id?: string } | null): boolean {
  return !!user && (!!user.is_super_admin || user.firm_id === CAMPOS_PILLAR_FIRM_ID)
}

const TABS = [
  { label: 'Operacional', href: '/pillar', icon: LayoutDashboard },
  { label: 'Marketing', href: '/pillar/marketing', icon: TrendingUp },
]

export default function PillarLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const isLogin = pathname === '/pillar/login'
  const [ok, setOk] = useState(false)

  // Título da aba do navegador reflete a marca (não o "NexusFlow" padrão).
  useEffect(() => { document.title = BRAND.name }, [])

  useEffect(() => {
    if (isLogin) return
    function check() {
      const user = getUser()
      if (!user || isSessionExpired() || !podeAcessar(user)) {
        router.replace('/pillar/login')
        return
      }
      // Produto sempre travado na firma Campos Pillar (inclusive p/ super-admin).
      localStorage.setItem('nf_firm_id', CAMPOS_PILLAR_FIRM_ID)
      setOk(true)
    }
    check()
    const id = setInterval(check, 60_000) // pega expiração no meio da sessão
    return () => clearInterval(id)
  }, [router, isLogin])

  // Tela de login: sem shell.
  if (isLogin) return <FirmProvider>{children}</FirmProvider>

  if (!ok) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  function handleLogout() {
    logout()
    router.replace('/pillar/login')
  }

  return (
    <FirmProvider>
      <div className="min-h-screen bg-slate-950 flex flex-col">
        {/* Cabeçalho branded */}
        <header className="border-b border-slate-800 bg-slate-900 px-4 sm:px-6 h-14 flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4 text-onaccent"/>
            </div>
            <div className="min-w-0 hidden sm:block">
              <p className="text-xs font-bold text-white truncate leading-tight">{BRAND.name}</p>
              <p className="text-[10px] text-slate-500 truncate leading-tight">{BRAND.tagline}</p>
            </div>
          </div>

          {/* Abas */}
          <nav className="flex items-center gap-1 ml-2">
            {TABS.map(tab => {
              const Icon = tab.icon
              const active = pathname === tab.href
              return (
                <button key={tab.href} onClick={() => router.push(tab.href)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition ${
                    active
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                      : 'bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}>
                  <Icon className="w-4 h-4"/>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              )
            })}
          </nav>

          <button onClick={handleLogout}
            className="ml-auto flex items-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition text-sm">
            <LogOut className="w-3.5 h-3.5"/> <span className="hidden sm:inline">Sair</span>
          </button>
        </header>

        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
    </FirmProvider>
  )
}
