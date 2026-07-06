'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen, Sparkles, GraduationCap, MessageSquareText, FileText,
  Scale, Sun, Calculator, Users, ArrowRight, CheckCircle2, Loader2,
  Zap, ShieldCheck, LogIn,
} from 'lucide-react'

const FEATURES = [
  { icon: FileText, title: 'Base de conhecimento', desc: 'Todos os processos, scripts e políticas num só lugar — versionados, com permissão por cargo.' },
  { icon: GraduationCap, title: 'Trilhas de treinamento', desc: 'Onboarding guiado com leitura, quizzes e certificados. Sua equipe aprende no ritmo certo.' },
  { icon: MessageSquareText, title: 'DocuChat com IA', desc: 'Um assistente que responde perguntas sobre os seus documentos, 24/7, no contexto da sua empresa.' },
  { icon: Zap, title: 'Pronto em minutos', desc: 'Escolha o segmento e o sistema já popula categorias, documentos e trilhas específicas do setor.' },
]

const SEGMENTS = [
  { icon: Scale, label: 'Advocacia Previdenciária', color: 'text-blue-400', ready: true },
  { icon: Sun, label: 'Energia Solar', color: 'text-amber-400', ready: true },
  { icon: Calculator, label: 'Contabilidade', color: 'text-green-400', ready: false },
  { icon: Users, label: 'RH e Gestão de Pessoas', color: 'text-purple-400', ready: false },
]

const STEPS = [
  { n: 1, title: 'Escolha o segmento', desc: 'Advocacia, energia solar e mais. Cada setor tem um pacote pensado para ele.' },
  { n: 2, title: 'Configuração automática', desc: 'Categorias, documentos modelo, trilhas e quizzes criados na hora.' },
  { n: 3, title: 'Sua equipe treina', desc: 'Convide o time, atribua trilhas por cargo e acompanhe o progresso.' },
]

export default function LandingPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [showLogin, setShowLogin] = useState(false)
  const [slug, setSlug] = useState('')

  useEffect(() => {
    // Já logado → dashboard. Cliente recorrente (slug salvo) segue vendo a landing,
    // mas com o acesso pré-preenchido.
    const user = localStorage.getItem('nf_user')
    const savedSlug = localStorage.getItem('nf_firm_slug')
    if (user && savedSlug) { router.replace('/app/dashboard'); return }
    if (savedSlug) setSlug(savedSlug)
    setChecking(false)
  }, [router])

  function entrar() {
    const s = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (s) router.push(`/${s}`)
  }

  if (checking) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-6 h-6 text-onaccent"/>
        </div>
        <Loader2 className="w-5 h-5 animate-spin text-amber-400 mx-auto"/>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Grid de fundo */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(212,160,23,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(212,160,23,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none"/>

      {/* Header */}
      <header className="relative z-10 max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <BookOpen className="w-5 h-5 text-onaccent"/>
          </div>
          <div>
            <p className="font-bold tracking-tight leading-none">NexusFlow</p>
            <p className="text-[10px] text-amber-400 font-mono">Documente e treine com IA</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowLogin(v => !v)}
            className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800 transition">
            <LogIn className="w-4 h-4"/> Entrar
          </button>
          <button onClick={() => router.push('/cadastro')}
            className="text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-onaccent px-4 py-2 rounded-lg transition">
            Criar empresa
          </button>
        </div>
      </header>

      {/* Painel de acesso do cliente (slug) */}
      {showLogin && (
        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <div className="ml-auto max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
            <p className="text-xs text-slate-400 mb-2">Já é cliente? Informe o endereço da sua empresa:</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center bg-slate-800 border border-slate-700 rounded-lg px-3 focus-within:border-amber-500 transition">
                <span className="text-slate-500 text-xs">/</span>
                <input value={slug} onChange={e => setSlug(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && entrar()}
                  placeholder="sua-empresa" autoFocus
                  className="flex-1 bg-transparent py-2 pl-1 text-sm text-white placeholder-slate-500 focus:outline-none"/>
              </div>
              <button onClick={entrar} disabled={!slug.trim()}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-onaccent p-2 rounded-lg transition">
                <ArrowRight className="w-4 h-4"/>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1 mb-6">
          <Sparkles className="w-3.5 h-3.5"/> Configuração automática por segmento
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] mb-5">
          Documente processos e treine<br className="hidden sm:block"/> sua equipe <span className="text-amber-400">com IA</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-8">
          A base de conhecimento inteligente para o seu segmento. Documentos, trilhas de
          treinamento e um assistente de IA — prontos em minutos, não em meses.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button onClick={() => router.push('/cadastro')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-onaccent font-semibold px-6 py-3 rounded-xl transition">
            Criar minha empresa grátis <ArrowRight className="w-4 h-4"/>
          </button>
          <button onClick={() => setShowLogin(true)}
            className="w-full sm:w-auto text-slate-300 hover:text-white font-medium px-6 py-3 rounded-xl border border-slate-800 hover:border-slate-600 transition">
            Já sou cliente
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-4">Trial de 14 dias · sem cartão de crédito</p>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(f => {
            const Icon = f.icon
            return (
              <div key={f.title} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-amber-400"/>
                </div>
                <h3 className="font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Como funciona */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold">Do zero à equipe treinada em 3 passos</h2>
          <p className="text-slate-400 text-sm mt-2">Sem planilhas soltas, sem PDF perdido no e-mail.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {STEPS.map(s => (
            <div key={s.n} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="w-9 h-9 rounded-full bg-amber-500 text-onaccent font-bold flex items-center justify-center mb-4">{s.n}</div>
              <h3 className="font-semibold mb-1.5">{s.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Segmentos */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-20">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold">Feito para o seu setor</h2>
          <p className="text-slate-400 text-sm mt-2">Cada segmento vem com conteúdo e trilhas específicas.</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {SEGMENTS.map(s => {
            const Icon = s.icon
            return (
              <div key={s.label} className={`bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col items-center text-center gap-2 ${s.ready ? '' : 'opacity-50'}`}>
                <Icon className={`w-7 h-7 ${s.color}`}/>
                <p className="text-sm font-medium">{s.label}</p>
                {s.ready
                  ? <span className="text-[10px] text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Disponível</span>
                  : <span className="text-[10px] text-slate-500">Em breve</span>}
              </div>
            )
          })}
        </div>
      </section>

      {/* CTA final */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 pb-24 text-center">
        <div className="bg-gradient-to-b from-slate-900 to-slate-900/40 border border-slate-800 rounded-3xl p-10">
          <ShieldCheck className="w-10 h-10 text-amber-400 mx-auto mb-4"/>
          <h2 className="text-2xl font-bold mb-2">Comece hoje com tudo configurado</h2>
          <p className="text-slate-400 mb-6 max-w-lg mx-auto">
            Crie sua empresa, escolha o segmento e veja a base de conhecimento e as trilhas
            nascerem prontas. Você só ajusta o que for seu.
          </p>
          <button onClick={() => router.push('/cadastro')}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-onaccent font-semibold px-6 py-3 rounded-xl transition">
            Criar minha empresa grátis <ArrowRight className="w-4 h-4"/>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-400"/>
            <span>NexusFlow</span>
          </div>
          <p className="text-xs">© 2026 NexusFlow · Documente e treine com IA</p>
        </div>
      </footer>
    </div>
  )
}
