'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { FirmProvider } from '@/lib/firm-context'
import Sidebar from '@/components/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const user = getUser()
    if (!user) router.push('/')
  }, [router])

  return (
    <FirmProvider>
      <div className="flex min-h-screen bg-slate-950">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </FirmProvider>
  )
}
