'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { useFirm } from '@/lib/firm-context'
import { useRouter } from 'next/navigation'
import {
  Settings, Key, Brain, Save, Eye, EyeOff,
  CheckCircle2, AlertCircle, Loader2, Sparkles,
  ExternalLink, ShieldCheck, Zap, Sun
} from 'lucide-react'

const MODELS = [
  { id: 'gpt-4o', label: 'GPT-4o', desc: 'Mais inteligente — recomendado', badge: 'Recomendado' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', desc: 'Mais rápido e econômico', badge: 'Econômico' },
  { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', desc: 'Básico, custo muito baixo', badge: null },
]

export default function ConfiguracoesPage() {
  const user = getUser()
  const router = useRouter()
  // firmId reativo: segue o "entrar como cliente" do super-admin (useFirm),
  // em vez do snapshot estático do localStorage (antigo getFirmId).
  const { firmId } = useFirm()

  const [settings, setSettings] = useState<any>(null)
  const [firm, setFirm] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<'ok'|'error'|null>(null)

  // Campos de IA
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [hasKey, setHasKey] = useState(false) // chave salva? (nunca lemos o valor)
  const [model, setModel] = useState('gpt-4o')
  const [aiEnabled, setAiEnabled] = useState(false)

  // Campos de empresa
  const [firmName, setFirmName] = useState('')
  const [brandColor, setBrandColor] = useState('#d4a017')

  // Dados para orçamento (usados no PDF/WhatsApp da calculadora solar)
  const [budget, setBudget] = useState({ whatsapp: '', phone: '', cnpj: '', site: '', address: '' })

  useEffect(() => {
    if (user?.role !== 'admin') { router.push('/app/dashboard'); return }
    load()
  }, [])

  async function load() {
    const [settingsRes, firmRes, hasKeyRes] = await Promise.all([
      // A chave (openai_api_key) NÃO é mais legível pelo cliente — só colunas públicas.
      supabase.from('nf_firm_settings').select('ai_model, ai_enabled, brand_color').eq('firm_id', firmId).single(),
      supabase.from('nf_firms').select('*').eq('id', firmId).single(),
      supabase.rpc('nf_has_ai_key', { p_firm_id: firmId }),
    ])
    const s = settingsRes.data
    const f = firmRes.data
    setSettings(s)
    setFirm(f)
    setHasKey(!!hasKeyRes.data)
    setApiKey('') // campo sempre começa vazio; a chave nunca vem do banco
    if (s) {
      setModel(s.ai_model || 'gpt-4o')
      setAiEnabled(s.ai_enabled || false)
      setBrandColor(s.brand_color || '#d4a017')
    }
    if (f) {
      setFirmName(f.name || '')
      setBudget({
        whatsapp: f.budget_whatsapp || '', phone: f.budget_phone || '',
        cnpj: f.budget_cnpj || '', site: f.budget_site || '', address: f.budget_address || '',
      })
    }
    setLoading(false)
  }

  async function saveSettings() {
    setSaving(true)
    setSaved(false)

    // Atualizar nome da empresa + dados de orçamento
    await supabase.from('nf_firms')
      .update({
        name: firmName,
        budget_whatsapp: budget.whatsapp || null,
        budget_phone: budget.phone || null,
        budget_cnpj: budget.cnpj || null,
        budget_site: budget.site || null,
        budget_address: budget.address || null,
      })
      .eq('id', firmId)

    // Sempre atualizar modelo e configurações de IA explicitamente
    const aiUpdates: any = {
      ai_model: model,
      ai_enabled: aiEnabled,
      brand_color: brandColor,
    }
    // Só grava a chave se o usuário digitou uma nova (campo começa vazio).
    if (apiKey.trim()) {
      aiUpdates.openai_api_key = apiKey.trim()
    }

    // Verificar se já existe registro
    const { data: existing } = await supabase
      .from('nf_firm_settings')
      .select('firm_id')
      .eq('firm_id', firmId)
      .single()

    if (existing) {
      // UPDATE explícito — garante que todas as colunas são atualizadas
      await supabase.from('nf_firm_settings')
        .update(aiUpdates)
        .eq('firm_id', firmId)
    } else {
      // INSERT se não existe
      await supabase.from('nf_firm_settings')
        .insert({ ...aiUpdates, firm_id: firmId })
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    await load()
  }

  async function testApiKey() {
    const keyToTest = apiKey.trim() || null
    if (!keyToTest && !hasKey) {
      setTestResult('error')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/test-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmId, apiKey: keyToTest }),
      })
      setTestResult(res.ok ? 'ok' : 'error')
    } catch {
      setTestResult('error')
    }
    setTesting(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full py-20">
      <Loader2 className="w-5 h-5 animate-spin text-amber-400"/>
    </div>
  )

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
          <Settings className="w-5 h-5 text-amber-400"/>
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Configurações</h1>
          <p className="text-slate-400 text-xs mt-0.5">Gerencie sua empresa e integrações de IA</p>
        </div>
      </div>

      {/* Empresa */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-4">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-slate-400"/> Dados da Empresa
        </h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Nome da empresa</label>
            <input value={firmName} onChange={e => setFirmName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"/>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Cor de destaque</label>
            <div className="flex items-center gap-3">
              <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-slate-700 bg-slate-800 cursor-pointer p-1"/>
              <input value={brandColor} onChange={e => setBrandColor(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-amber-500 transition"/>
              <div className="w-10 h-10 rounded-lg border border-slate-700 shrink-0"
                style={{ background: brandColor }}/>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Link de acesso da empresa</label>
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5">
              <span className="text-xs text-slate-500 font-mono">nexusflow-lake.vercel.app/</span>
              <span className="text-xs text-amber-400 font-mono">{firm?.slug}</span>
              <a href={`https://nexusflow-lake.vercel.app/${firm?.slug}`} target="_blank"
                className="ml-auto text-slate-500 hover:text-slate-300">
                <ExternalLink className="w-3.5 h-3.5"/>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Dados para orçamento (solar) — usados no PDF e na mensagem de WhatsApp */}
      {firm?.segment === 'solar' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-4">
          <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-400"/> Dados para orçamento
          </h2>
          <p className="text-xs text-slate-500 mb-4">Aparecem no PDF e na mensagem de WhatsApp gerados pela Calculadora de Orçamento Solar.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">WhatsApp comercial</label>
              <input value={budget.whatsapp} onChange={e => setBudget(b => ({ ...b, whatsapp: e.target.value }))}
                placeholder="(42) 99999-9999"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"/>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Telefone / fixo</label>
              <input value={budget.phone} onChange={e => setBudget(b => ({ ...b, phone: e.target.value }))}
                placeholder="(42) 3333-3333"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"/>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">CNPJ</label>
              <input value={budget.cnpj} onChange={e => setBudget(b => ({ ...b, cnpj: e.target.value }))}
                placeholder="00.000.000/0001-00"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"/>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Site</label>
              <input value={budget.site} onChange={e => setBudget(b => ({ ...b, site: e.target.value }))}
                placeholder="www.climadek.com.br"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"/>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-400 block mb-1.5">Endereço</label>
              <input value={budget.address} onChange={e => setBudget(b => ({ ...b, address: e.target.value }))}
                placeholder="Rua Exemplo, 123 — Centro, Irati/PR"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"/>
            </div>
          </div>
        </div>
      )}

      {/* IA */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-400"/> Inteligência Artificial
          </h2>
          <button onClick={() => setAiEnabled(!aiEnabled)}
            className={`relative w-10 h-5 rounded-full transition ${aiEnabled ? 'bg-amber-500' : 'bg-slate-700'}`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${aiEnabled ? 'left-5' : 'left-0.5'}`}/>
          </button>
        </div>

        {!aiEnabled ? (
          <div className="bg-slate-800/50 rounded-xl p-4 text-center">
            <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-2"/>
            <p className="text-sm text-slate-400">IA desativada</p>
            <p className="text-xs text-slate-600 mt-1">Ative e configure sua chave da OpenAI para usar o DocuChat, geração de documentos e busca inteligente.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Chave API */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Key className="w-3 h-3"/> Chave da OpenAI
                  {hasKey && (
                    <span className="flex items-center gap-1 text-[10px] text-green-400">
                      <CheckCircle2 className="w-3 h-3"/> configurada
                    </span>
                  )}
                </label>
                <a href="https://platform.openai.com/api-keys" target="_blank"
                  className="text-[10px] text-amber-400 hover:underline flex items-center gap-1">
                  Obter chave <ExternalLink className="w-2.5 h-2.5"/>
                </a>
              </div>
              <div className="relative">
                <input type={showKey ? 'text' : 'password'} value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={hasKey ? 'Chave salva — preencha para substituir' : 'sk-proj-...'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500 transition"/>
                <button onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                  {showKey ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button onClick={testApiKey} disabled={testing || !apiKey}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg transition disabled:opacity-40">
                  {testing ? <Loader2 className="w-3 h-3 animate-spin"/> : <Zap className="w-3 h-3"/>}
                  Testar conexão
                </button>
                {testResult === 'ok' && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <CheckCircle2 className="w-3 h-3"/> Chave válida!
                  </span>
                )}
                {testResult === 'error' && (
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <AlertCircle className="w-3 h-3"/> Chave inválida ou sem créditos
                  </span>
                )}
              </div>
            </div>

            {/* Modelo */}
            <div>
              <label className="text-xs text-slate-400 block mb-2">Modelo</label>
              <div className="space-y-2">
                {MODELS.map(m => (
                  <button key={m.id} onClick={() => setModel(m.id)}
                    className={`w-full flex items-center gap-3 text-left px-4 py-3 rounded-xl border transition ${
                      model === m.id
                        ? 'bg-amber-500/10 border-amber-500/30 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      model === m.id ? 'border-amber-400' : 'border-slate-600'
                    }`}>
                      {model === m.id && <div className="w-2 h-2 rounded-full bg-amber-400"/>}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{m.label}</span>
                        {m.badge && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">{m.badge}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{m.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-blue-400/5 border border-blue-400/15 rounded-xl p-3">
              <p className="text-xs text-blue-400 font-medium mb-1">Como funciona</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Sua chave é armazenada com segurança no banco de dados da sua empresa. Ela é usada para o DocuChat, geração de documentos com IA e busca inteligente. Cada empresa usa sua própria cota da OpenAI.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Salvar */}
      <button onClick={saveSettings} disabled={saving}
        className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-onaccent font-semibold py-3 rounded-xl transition">
        {saving ? <Loader2 className="w-4 h-4 animate-spin"/> :
         saved ? <><CheckCircle2 className="w-4 h-4"/> Salvo!</> :
         <><Save className="w-4 h-4"/> Salvar configurações</>}
      </button>
    </div>
  )
}
