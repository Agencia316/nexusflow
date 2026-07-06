'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getUser, logout } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useFirm } from '@/lib/firm-context'
import FirmSwitcher from '@/components/FirmSwitcher'
import ThemeToggle from '@/components/ThemeToggle'
import {
  LayoutDashboard, FileText, Plus, MessageSquareText,
  GraduationCap, BarChart3, Users, LogOut, BookOpen,
  ChevronRight, Wrench, Shield, Bell, Library, Settings,
  Building2, Menu, X
} from 'lucide-react'

// managerOnly = admin + editor | adminOnly = admin only | superOnly = super-admin (Três16)
const nav = [
  { label: 'Administração',        href: '/app/admin',        icon: Building2, superOnly: true },
  { label: 'Dashboard',            href: '/app/dashboard',    icon: LayoutDashboard },
  { label: 'Treinamentos',         href: '/app/training',     icon: GraduationCap },
  { label: 'Alertas',              href: '/app/alertas',      icon: Bell, badge: true },
  { label: 'Base de Conhecimento', href: '/app/docs',         icon: FileText },
  { label: 'Novo Documento',       href: '/app/docs/new',     icon: Plus, sub: true, managerOnly: true },
  { label: 'Modelos',              href: '/app/templates',    icon: Library, sub: true },
  { label: 'DocuChat (IA)',        href: '/app/chat',         icon: MessageSquareText },
  { label: 'Ferramentas',          href: '/app/ferramentas',  icon: Wrench },
  { label: 'Relatórios',           href: '/app/reports',      icon: BarChart3, managerOnly: true },
  { label: 'Equipe',               href: '/app/team',         icon: Users },
  { label: 'Permissões',           href: '/app/permissoes',   icon: Shield, adminOnly: true },
  { label: 'Configurações',        href: '/app/configuracoes',icon: Settings, adminOnly: true },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const user = getUser()
  const { firmId, isSuperAdmin } = useFirm()
  const [alertCount, setAlertCount] = useState(0)
  const [firmName, setFirmName] = useState('')
  const [open, setOpen] = useState(false) // drawer mobile

  // Fecha o drawer ao navegar.
  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    if (!user) return

    // Buscar alertas não lidos
    async function loadAlerts() {
      const { count } = await supabase
        .from('nf_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('firm_id', firmId)
        .eq('user_id', user!.id)
        .is('read_at', null)
      setAlertCount(count || 0)
    }

    // Buscar nome da firma
    async function loadFirm() {
      const { data } = await supabase.from('nf_firms').select('name').eq('id', firmId).single()
      if (data) setFirmName(data.name)
    }

    loadAlerts()
    loadFirm()

    // Polling a cada 30s
    const interval = setInterval(loadAlerts, 30000)
    return () => clearInterval(interval)
  }, [firmId])

  function handleLogout() {
    logout()
    router.push('/')
  }

  const visibleNav = nav.filter(item => {
    if ((item as any).superOnly && !isSuperAdmin) return false
    if (item.adminOnly && user?.role !== 'admin') return false
    if ((item as any).managerOnly && user?.role !== 'admin' && user?.role !== 'editor') return false
    return true
  })

  return (
    <>
      {/* Barra superior — só no mobile */}
      <div className="md:hidden fixed top-0 inset-x-0 h-14 z-40 flex items-center gap-3 px-4 bg-slate-900 border-b border-slate-800">
        <button onClick={() => setOpen(true)} className="p-2 -ml-2 text-slate-300 hover:text-white transition" aria-label="Abrir menu">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-onaccent" />
          </div>
          <span className="text-sm font-bold text-white truncate">NexusFlow</span>
        </div>
      </div>

      {/* Backdrop do drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar / Drawer */}
      <aside className={`w-64 md:w-60 h-screen md:h-auto md:min-h-screen bg-slate-900 border-r border-slate-800 flex flex-col shrink-0
        fixed md:static top-0 left-0 z-50 transition-transform duration-200 md:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="px-4 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-onaccent"/>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate leading-tight">NexusFlow</p>
              <p className="text-[10px] text-slate-500 truncate leading-tight">{firmName || user?.firm_name || '...'}</p>
            </div>
          </div>
          {/* Fechar (mobile) */}
          <button onClick={() => setOpen(false)} className="md:hidden p-1.5 -mr-1 text-slate-400 hover:text-white transition" aria-label="Fechar menu">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Seletor de firma — visível apenas para super-admin */}
        <FirmSwitcher />

        {/* Navegação */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleNav.map(item => {
          const active = pathname === item.href || (item.href !== '/app/dashboard' && pathname.startsWith(item.href) && !item.sub)
          const Icon = item.icon

          return (
            <button key={item.href} onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition relative ${
                item.sub ? 'ml-4 w-[calc(100%-16px)]' : ''
              } ${
                active
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
              }`}>
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-amber-400' : ''}`}/>
              <span className="text-sm truncate">{item.label}</span>
              {item.badge && alertCount > 0 && (
                <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
              {active && !item.badge && <ChevronRight className="w-3 h-3 ml-auto text-amber-400 opacity-60"/>}
            </button>
          )
        })}
        </nav>

        {/* Tema */}
        <div className="px-3 pt-3 border-t border-slate-800">
          <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5 px-1">Aparência</p>
          <ThemeToggle />
        </div>

        {/* Usuário */}
        <div className="px-3 py-3 border-t border-slate-800 mt-3">
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0">
              {user?.name?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-500 capitalize">{user?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition text-sm">
            <LogOut className="w-3.5 h-3.5"/> Sair
          </button>
        </div>
      </aside>
    </>
  )
}
