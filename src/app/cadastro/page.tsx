'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setToken } from '@/lib/session'
import {
  BookOpen, Building2, User, Mail, Lock, ChevronRight,
  Loader2, CheckCircle2, AlertCircle, Scale, Sun,
  Calculator, Users, Eye, EyeOff, Sparkles, Brain, Key, ExternalLink
} from 'lucide-react'
// Constantes puras — o index de `@/lib/ai` puxa o SDK da Anthropic (só servidor).
import {
  AI_PROVIDERS, PROVIDER_LABEL, KEY_HINT, CONSOLE_URL, type AiProvider,
} from '@/lib/ai/providers'

const SEGMENTS = [
  {
    id: 'advocacia',
    label: 'Advocacia Previdenciária',
    icon: Scale,
    color: 'border-blue-500/40 bg-blue-500/5 text-blue-400',
    activeColor: 'border-blue-500 bg-blue-500/15 text-blue-300',
    desc: 'Scripts, qualificação J1–J5, checklist INSS, trilhas para SDR e Closer',
    items: ['Fluxo captação → protocolo INSS', 'Scripts WhatsApp prontos', 'Qualificação jurídica B-36/B-94', 'Trilhas para SDR e Closer', 'Checklist de documentação'],
  },
  {
    id: 'solar',
    label: 'Energia Solar',
    icon: Sun,
    color: 'border-amber-500/40 bg-amber-500/5 text-amber-400',
    activeColor: 'border-amber-500 bg-amber-500/15 text-amber-300',
    desc: 'Processo de venda, visita técnica, instalação, garantia e pós-venda',
    items: ['Fluxo completo de vendas', 'Script de abordagem de leads', 'Checklist de visita técnica', 'Processo de instalação ABNT', 'Política de garantia'],
  },
  {
    id: 'contabilidade',
    label: 'Contabilidade',
    icon: Calculator,
    color: 'border-green-500/40 bg-green-500/5 text-green-400',
    activeColor: 'border-green-500 bg-green-500/15 text-green-300',
    desc: 'Em breve — templates e trilhas para escritórios contábeis',
    items: ['Em desenvolvimento'],
    disabled: true,
  },
  {
    id: 'rh',
    label: 'RH e Gestão de Pessoas',
    icon: Users,
    color: 'border-purple-500/40 bg-purple-500/5 text-purple-400',
    activeColor: 'border-purple-500 bg-purple-500/15 text-purple-300',
    desc: 'Em breve — templates de onboarding, avaliação e treinamento',
    items: ['Em desenvolvimento'],
    disabled: true,
  },
]

type Step = 'segment' | 'info' | 'ia' | 'success'
const STEPS: Step[] = ['segment', 'info', 'ia', 'success']

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export default function CadastroPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('segment')
  const [segment, setSegment] = useState('')
  const [firmName, setFirmName] = useState('')
  const [solarUf, setSolarUf] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)

  // Passo de IA
  const [aiProvider, setAiProvider] = useState<AiProvider>('anthropic')
  const [aiApiKey, setAiApiKey] = useState('')
  const [showAiKey, setShowAiKey] = useState(false)

  function goToIaStep() {
    if (!firmName.trim() || !adminName.trim() || !adminEmail.trim() || !adminPassword.trim()) {
      setError('Preencha todos os campos.')
      return
    }
    setError('')
    setStep('ia')
  }

  /** `skipAi` ignora o que estiver digitado no campo da chave. */
  async function handleSubmit(skipAi = false) {
    if (!firmName.trim() || !adminName.trim() || !adminEmail.trim() || !adminPassword.trim()) {
      setError('Preencha todos os campos.')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmName, segment, adminName, adminEmail, adminPassword, solarUf,
          // Chave vazia = "configurar depois": a firma nasce com a IA desligada.
          aiProvider, aiApiKey: skipAi ? '' : aiApiKey.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Erro ao criar empresa.')
        setLoading(false)
        return
      }
      setResult(data)
      setStep('success')
    } catch {
      setError('Erro de conexão. Tente novamente.')
    }
    setLoading(false)
  }

  const selectedSegment = SEGMENTS.find(s => s.id === segment)

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Grid background */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(212,160,23,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(212,160,23,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none"/>

      <div className="relative w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <BookOpen className="w-6 h-6 text-onaccent"/>
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-white tracking-tight">NexusFlow</h1>
              <p className="text-xs text-amber-400 font-mono">Documente e treine com IA</p>
            </div>
          </div>
          <p className="text-slate-400 text-sm">Crie sua empresa e comece com tudo configurado para o seu segmento.</p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => {
            const atual = STEPS.indexOf(step)
            const concluido = i < atual
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                  step === s ? 'bg-amber-500 text-onaccent' :
                  concluido ? 'bg-green-500 text-white' :
                  'bg-slate-800 text-slate-500'
                }`}>
                  {concluido ? '✓' : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-9 h-0.5 ${concluido ? 'bg-green-500' : 'bg-slate-800'}`}/>
                )}
              </div>
            )
          })}
        </div>

        {/* Step 1 — Escolher segmento */}
        {step === 'segment' && (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white">Qual é o segmento da sua empresa?</h2>
              <p className="text-slate-400 text-sm mt-1">Vamos configurar tudo automaticamente para o seu setor.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {SEGMENTS.map(seg => {
                const Icon = seg.icon
                const isActive = segment === seg.id
                return (
                  <button key={seg.id} onClick={() => !seg.disabled && setSegment(seg.id)}
                    disabled={seg.disabled}
                    className={`p-4 rounded-xl border text-left transition relative ${
                      seg.disabled ? 'opacity-40 cursor-not-allowed border-slate-800 bg-slate-900/50' :
                      isActive ? seg.activeColor : seg.color + ' hover:opacity-90'
                    }`}>
                    {seg.disabled && (
                      <span className="absolute top-2 right-2 text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full">Em breve</span>
                    )}
                    <Icon className="w-6 h-6 mb-2"/>
                    <p className="font-semibold text-white text-sm mb-1">{seg.label}</p>
                    <p className="text-[11px] opacity-70 leading-snug">{seg.desc}</p>
                    {isActive && (
                      <div className="mt-3 space-y-1">
                        {seg.items.map(item => (
                          <div key={item} className="flex items-center gap-1.5 text-[11px] text-green-400">
                            <CheckCircle2 className="w-3 h-3 shrink-0"/>
                            {item}
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {segment && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-4 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5"/>
                <div>
                  <p className="text-sm text-amber-400 font-medium">Configuração automática para {selectedSegment?.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ao criar sua empresa, o sistema vai popular automaticamente: categorias, documentos, trilhas de treinamento e quizzes específicos para o seu segmento.
                  </p>
                </div>
              </div>
            )}

            <button onClick={() => setStep('info')} disabled={!segment}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-onaccent font-semibold py-3 rounded-xl transition">
              Continuar <ChevronRight className="w-4 h-4"/>
            </button>
          </div>
        )}

        {/* Step 2 — Dados da empresa */}
        {step === 'info' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
            <button onClick={() => setStep('segment')} className="text-xs text-slate-500 hover:text-slate-300 transition mb-6 flex items-center gap-1">
              ← Voltar
            </button>
            <h2 className="text-xl font-bold text-white mb-1">Dados da empresa</h2>
            <p className="text-slate-400 text-sm mb-6">
              Segmento: <span className="text-amber-400 font-medium">{selectedSegment?.label}</span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1.5">Nome da empresa *</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
                  <input value={firmName} onChange={e => setFirmName(e.target.value)}
                    placeholder="Ex: Climadek Energia Solar"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"/>
                </div>
              </div>

              {segment === 'solar' && (
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1.5">Estado de atuação (UF)</label>
                  <div className="relative">
                    <Sun className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
                    <select value={solarUf} onChange={e => setSolarUf(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition appearance-none">
                      <option value="">Selecione o estado…</option>
                      {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1.5">A calculadora de orçamento já abre com a tarifa e a região do seu estado.</p>
                </div>
              )}

              <div className="border-t border-slate-800 pt-4">
                <p className="text-xs font-medium text-slate-400 mb-3">Conta do administrador</p>
                <div className="space-y-3">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
                    <input value={adminName} onChange={e => setAdminName(e.target.value)}
                      placeholder="Seu nome completo"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"/>
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
                    <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"/>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
                    <input type={showPass ? 'text' : 'password'} value={adminPassword} onChange={e => setAdminPassword(e.target.value)}
                      placeholder="Senha (mínimo 6 caracteres)"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"/>
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                      {showPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0"/> {error}
                </div>
              )}

              <button onClick={goToIaStep}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-onaccent font-semibold py-3 rounded-xl transition">
                Continuar <ChevronRight className="w-4 h-4"/>
              </button>
              <p className="text-center text-xs text-slate-600">
                Plano Trial — 14 dias grátis, sem cartão de crédito
              </p>
            </div>
          </div>
        )}

        {/* Step 3 — Chave de IA */}
        {step === 'ia' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
            <button onClick={() => setStep('info')} className="text-xs text-slate-500 hover:text-slate-300 transition mb-6 flex items-center gap-1">
              ← Voltar
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
                <Brain className="w-5 h-5 text-amber-400"/>
              </div>
              <h2 className="text-xl font-bold text-white">Conecte sua IA</h2>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              O DocuChat, a geração de documentos e a busca inteligente usam a chave da sua empresa —
              sua cota, seu controle. Escolha o provedor que preferir.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-2">Provedor</label>
                <div className="grid grid-cols-2 gap-2">
                  {AI_PROVIDERS.map(p => (
                    <button key={p} onClick={() => { setAiProvider(p); setAiApiKey('') }}
                      className={`flex items-center gap-2.5 text-left px-4 py-3 rounded-xl border transition ${
                        aiProvider === p
                          ? 'bg-amber-500/10 border-amber-500/30 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        aiProvider === p ? 'border-amber-400' : 'border-slate-600'
                      }`}>
                        {aiProvider === p && <div className="w-2 h-2 rounded-full bg-amber-400"/>}
                      </div>
                      <span className="text-sm font-medium">{PROVIDER_LABEL[p]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Key className="w-3 h-3"/> Chave de API · {PROVIDER_LABEL[aiProvider]}
                  </label>
                  <a href={CONSOLE_URL[aiProvider]} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] text-amber-400 hover:underline flex items-center gap-1">
                    Obter chave <ExternalLink className="w-2.5 h-2.5"/>
                  </a>
                </div>
                <div className="relative">
                  <input type={showAiKey ? 'text' : 'password'} value={aiApiKey}
                    onChange={e => setAiApiKey(e.target.value)}
                    placeholder={KEY_HINT[aiProvider]}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500 transition"/>
                  <button onClick={() => setShowAiKey(!showAiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                    {showAiKey ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
                <p className="text-[11px] text-slate-600 mt-2">
                  A chave é guardada no banco da sua empresa e nunca volta para o navegador. Validamos assim que a empresa for criada.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0"/> {error}
                </div>
              )}

              <button onClick={() => handleSubmit(false)} disabled={loading || !aiApiKey.trim()}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-onaccent font-semibold py-3 rounded-xl transition">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin"/> Criando empresa e configurando...</>
                : <><Sparkles className="w-4 h-4"/> Criar empresa com configuração automática</>}
              </button>

              <button onClick={() => handleSubmit(true)} disabled={loading}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition disabled:opacity-50">
                Configurar depois — a IA fica desligada até você cadastrar a chave
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Sucesso */}
        {step === 'success' && result && (
          <div className="bg-slate-900 border border-green-500/30 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-400"/>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Empresa criada!</h2>
            <p className="text-slate-400 text-sm mb-2">
              <span className="text-white font-medium">{firmName}</span> foi configurada automaticamente com:
            </p>

            <div className="grid grid-cols-3 gap-3 my-6">
              {[
                { label: 'Categorias', value: result.created?.categories || 0 },
                { label: 'Documentos', value: result.created?.documents || 0 },
                { label: 'Trilhas', value: result.created?.training_paths || 0 },
              ].map(s => (
                <div key={s.label} className="bg-slate-800 rounded-xl p-3">
                  <p className="text-2xl font-bold text-amber-400">{s.value}</p>
                  <p className="text-xs text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Estado da IA. `null` = não informou chave; `false` = informou e é inválida. */}
            <div className="mb-2">
              {result.aiKeyValid === true && (
                <p className="flex items-center justify-center gap-1.5 text-xs text-green-400">
                  <CheckCircle2 className="w-3.5 h-3.5"/> IA conectada — DocuChat pronto para usar.
                </p>
              )}
              {result.aiKeyValid === false && (
                <p className="flex items-start justify-center gap-1.5 text-xs text-amber-400 text-left">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0"/>
                  A chave informada não foi aceita pelo provedor. A empresa foi criada com a IA desligada — cadastre a chave em Configurações → IA.
                </p>
              )}
              {result.aiKeyValid == null && (
                <p className="flex items-start justify-center gap-1.5 text-xs text-slate-500 text-left">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0"/>
                  IA desligada. Cadastre a chave em Configurações → IA para liberar o DocuChat.
                </p>
              )}
            </div>

            <div className="bg-slate-800 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs text-slate-400 mb-2 font-medium">Dados de acesso</p>
              <p className="text-sm text-white"><span className="text-slate-400">E-mail:</span> {adminEmail}</p>
              <p className="text-sm text-white mt-1"><span className="text-slate-400">Senha:</span> ••••••</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={async () => {
                  // Login automático pelo caminho ÚNICO: /api/session/login emite o
                  // JWT de sessão. Sem esse token, o RLS por tenant bloqueia tudo e
                  // o dashboard abriria vazio. Reusa email+senha recém-cadastrados.
                  try {
                    const res = await fetch('/api/session/login', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: adminEmail, password: adminPassword, firmId: result.firmId }),
                    })
                    const out = await res.json()
                    if (res.ok && out.token) {
                      localStorage.setItem('nf_user', JSON.stringify({ ...out.user, firm_name: firmName, firm_segment: segment }))
                      localStorage.setItem('nf_login_ts', Date.now().toString())
                      localStorage.setItem('nf_firm_id', out.user.firm_id)
                      localStorage.setItem('nf_firm_slug', result.slug)
                      setToken(out.token)
                      router.push('/app/dashboard')
                      return
                    }
                  } catch { /* cai no fallback */ }
                  // Fallback seguro: manda para a tela de login da própria firma.
                  router.push(`/${result.slug}`)
                }}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-onaccent font-semibold py-3 rounded-xl transition">
                Acessar minha empresa <ChevronRight className="w-4 h-4"/>
              </button>
              <p className="text-xs text-slate-600">
                Próximos acessos: <span className="text-slate-500 font-mono">nexusflow-lake.vercel.app/{result.slug}</span>
              </p>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-slate-600 mt-6">
          Já tem uma conta? <button onClick={() => router.push('/')} className="text-amber-500 hover:underline">Fazer login</button>
        </p>
      </div>
    </div>
  )
}
