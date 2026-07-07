'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { setToken } from '@/lib/session'
import { BookOpen, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, Building2 } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Login por usuário — só e-mail + senha, sem informar a empresa.
 * O servidor valida (bcrypt) e devolve o firm_id do próprio usuário; a empresa
 * é resolvida a partir dele. Complementa o login por empresa (/[slug]).
 */
export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Já logado → dashboard.
    if (localStorage.getItem('nf_user')) router.replace('/app/dashboard')
  }, [router])

  async function handleLogin() {
    if (!email.trim() || !password.trim()) { setError('Preencha todos os campos.'); return }
    setLoading(true); setError('')

    // Sem firmId: o login é inequívoco porque o e-mail é único no sistema.
    const res = await fetch('/api/session/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const out = await res.json()
    if (!res.ok) {
      setError(out.error || 'E-mail ou senha incorretos.')
      setLoading(false); return
    }

    // Resolve a empresa a partir do firm_id retornado (o nf_login não devolve
    // slug/nome/segmento). Necessário para branding e redirecionamentos.
    const { data: firm } = await supabase
      .from('nf_firms')
      .select('slug, name, segment')
      .eq('id', out.user.firm_id)
      .single()

    const user = {
      ...out.user,
      firm_name: firm?.name,
      firm_segment: firm?.segment,
    }

    localStorage.setItem('nf_user', JSON.stringify(user))
    localStorage.setItem('nf_login_ts', Date.now().toString())
    localStorage.setItem('nf_firm_id', user.firm_id)
    if (firm?.slug) localStorage.setItem('nf_firm_slug', firm.slug)
    setToken(out.token)

    router.push('/app/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(212,160,23,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(212,160,23,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none"/>

      <div className="relative w-full max-w-sm">
        {/* Marca da plataforma */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-7 h-7 text-amber-400"/>
          </div>
          <h1 className="text-2xl font-bold text-white">Entrar no NexusFlow</h1>
          <p className="text-slate-500 text-sm mt-1">Acesse com seu e-mail e senha</p>
        </div>

        {/* Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="seu@email.com" autoFocus
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
            <input
              type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Sua senha"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
            />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              {showPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0"/> {error}
            </div>
          )}

          <button onClick={handleLogin} disabled={loading}
            className="w-full flex items-center justify-center gap-2 font-semibold py-2.5 rounded-lg transition bg-amber-500 hover:bg-amber-400 text-onaccent disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Entrar'}
          </button>
        </div>

        {/* Acesso alternativo por empresa (slug) */}
        <button onClick={() => router.push('/')}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mt-4 transition">
          <Building2 className="w-3.5 h-3.5"/> Acessar pelo endereço da empresa
        </button>
      </div>
    </div>
  )
}
