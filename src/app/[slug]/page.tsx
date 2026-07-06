'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { BookOpen, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function SlugLoginPage() {
  const { slug } = useParams()
  const router = useRouter()

  const [firm, setFirm] = useState<any>(null)
  const [notFound, setNotFound] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingFirm, setLoadingFirm] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadFirm() {
      const { data } = await supabase
        .from('nf_firms')
        .select('id, name, slug, segment, primary_color, accent_color, logo_url')
        .eq('slug', slug)
        .single()

      if (!data) { setNotFound(true) }
      else { setFirm(data) }
      setLoadingFirm(false)
    }
    if (slug) loadFirm()
  }, [slug])

  async function handleLogin() {
    if (!email.trim() || !password.trim()) { setError('Preencha todos os campos.'); return }
    setLoading(true); setError('')

    const { data, error: rpcError } = await supabase
      .rpc('nf_login', { p_email: email, p_password: password })

    if (rpcError || !data || data.length === 0) {
      setError('E-mail ou senha incorretos.')
      setLoading(false); return
    }

    const row = data[0]

    // Verificar se o usuário pertence a esta firma
    if (row.firm_id !== firm.id) {
      setError('Esse usuário não pertence a esta empresa.')
      setLoading(false); return
    }

    const user = {
      id: row.id, name: row.name, email: row.email,
      role: row.role, firm_id: row.firm_id,
      firm_name: firm.name, firm_segment: firm.segment,
    }

    localStorage.setItem('nf_user', JSON.stringify(user))
    localStorage.setItem('nf_login_ts', Date.now().toString())
    localStorage.setItem('nf_firm_id', row.firm_id)
    localStorage.setItem('nf_firm_slug', firm.slug)

    router.push('/app/dashboard')
  }

  // Cor de destaque da firma (padrão amber)
  const accent = firm?.accent_color || '#d4a017'
  const segmentIcon = firm?.segment === 'solar' ? '☀️' : '⚖️'

  if (loadingFirm) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-amber-400"/>
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl mb-4">🔍</div>
      <h1 className="text-2xl font-bold text-white mb-2">Empresa não encontrada</h1>
      <p className="text-slate-400 text-sm mb-6">O endereço <span className="text-white font-mono">/{slug}</span> não existe.</p>
      <button onClick={() => router.push('/cadastro')}
        className="bg-amber-500 hover:bg-amber-400 text-onaccent font-semibold px-6 py-2.5 rounded-lg transition text-sm">
        Criar minha empresa →
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(212,160,23,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(212,160,23,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none"/>

      <div className="relative w-full max-w-sm">
        {/* Logo da plataforma + firma */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-slate-600 text-xs mb-4">
            <BookOpen className="w-3.5 h-3.5"/>
            <span>NexusFlow</span>
          </div>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 text-3xl"
            style={{ background: `${accent}20`, border: `1px solid ${accent}40` }}>
            {segmentIcon}
          </div>
          <h1 className="text-2xl font-bold text-white">{firm.name}</h1>
          <p className="text-slate-500 text-sm mt-1">Acesse sua conta</p>
        </div>

        {/* Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="seu@email.com"
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
            className="w-full flex items-center justify-center gap-2 font-semibold py-2.5 rounded-lg transition text-onaccent disabled:opacity-50"
            style={{ background: accent }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Entrar'}
          </button>
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          Powered by <span className="text-slate-500">NexusFlow</span>
        </p>
      </div>
    </div>
  )
}
