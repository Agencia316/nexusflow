'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getUser, logout } from '@/lib/auth'
import { isSessionExpired } from '@/lib/session'
import { FirmProvider } from '@/lib/firm-context'
import Sidebar from '@/components/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    // Sessão sem usuário, ou token vencido/ausente (com RLS ligado): força login.
    function check() {
      if (!getUser() || isSessionExpired()) {
        logout()
        router.push('/')
      }
    }
    check()
    const id = setInterval(check, 60_000) // pega expiração no meio da sessão
    return () => clearInterval(id)
  }, [router])

  return (
    <FirmProvider>
      <div className="flex min-h-screen bg-slate-950">
        <Sidebar />
        {/* pt-14 no mobile reserva espaço para a barra superior fixa do Sidebar */}
        <main className="flex-1 min-w-0 overflow-auto pt-14 md:pt-0">
          {children}
        </main>
      </div>
    </FirmProvider>
  )
}
