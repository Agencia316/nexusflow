'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Loader2 } from 'lucide-react'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    // Se tem slug salvo na sessão, redireciona pro login da empresa
    const slug = localStorage.getItem('nf_firm_slug')
    const user = localStorage.getItem('nf_user')

    if (user && slug) {
      // Usuário logado — vai pro dashboard
      router.push('/app/dashboard')
    } else if (slug) {
      // Tem slug mas não está logado — vai pro login da empresa
      router.push(`/${slug}`)
    } else {
      // Nenhuma empresa — vai pro cadastro
      router.push('/cadastro')
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-6 h-6 text-slate-950"/>
        </div>
        <Loader2 className="w-5 h-5 animate-spin text-amber-400 mx-auto"/>
      </div>
    </div>
  )
}
