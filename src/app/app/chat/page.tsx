'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { useFirm } from '@/lib/firm-context'
import Link from 'next/link'
import {
  Send, Loader2, Bot, User, Sparkles, BookOpen,
  RotateCcw, Copy, CheckCheck, ChevronRight, KeyRound, Settings
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getToken } from '@/lib/session'
import { DEFAULT_MODEL } from '@/lib/ai/providers'

interface Message { role: 'user' | 'assistant'; content: string }

export default function ChatPage() {
  const user = getUser()
  const { firmId } = useFirm()
  const bottomRef = useRef<HTMLDivElement>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<any>(null)
  const [copied, setCopied] = useState<number|null>(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  /** A chave nunca é lida pelo cliente; a RPC só diz se existe. */
  const [hasAiKey, setHasAiKey] = useState(false)

  useEffect(() => {
    async function load() {
      const [settingsRes, hasKeyRes] = await Promise.all([
        supabase
          .from('nf_firm_settings')
          .select('chat_persona, chat_welcome, chat_suggestions, ai_enabled, brand_color, ai_model')
          .eq('firm_id', firmId)
          .single(),
        supabase.rpc('nf_has_ai_key', { p_firm_id: firmId }),
      ])
      setSettings(settingsRes.data)
      setHasAiKey(!!hasKeyRes.data)
      setLoadingSettings(false)
    }
    load()
  }, [firmId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text?: string) {
    const content = (text || input).trim()
    if (!content || loading) return

    const newMessages: Message[] = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() || ''}` },
        body: JSON.stringify({ messages: newMessages, firmId }),
      })
      const data = await res.json()
      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${data.error}` }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.content }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Erro de conexão. Tente novamente.' }])
    }
    setLoading(false)
  }

  function copyMessage(text: string, idx: number) {
    navigator.clipboard.writeText(text)
    setCopied(idx)
    setTimeout(() => setCopied(null), 2000)
  }

  const persona = settings?.chat_persona || 'DocuChat · NexusFlow IA'
  const welcome = settings?.chat_welcome || 'Olá! Como posso ajudar?'
  const suggestions: string[] = settings?.chat_suggestions || []
  const accent = settings?.brand_color || '#d4a017'

  if (loadingSettings) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-5 h-5 animate-spin text-amber-400"/>
    </div>
  )

  // Sem IA ligada ou sem chave, o /api/chat responderia 503 a cada envio.
  // Melhor dizer antes, e mandar quem pode resolver direto para o lugar certo.
  const aiReady = !!settings?.ai_enabled && hasAiKey
  if (!aiReady) {
    const isAdmin = user?.role === 'admin'
    return (
      <div className="flex items-center justify-center h-full px-6">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-6 h-6 text-amber-400"/>
          </div>
          <h1 className="text-lg font-semibold text-white mb-2">IA ainda não configurada</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            O DocuChat usa a chave de IA da sua empresa. Escolha o provedor —{' '}
            <span className="text-slate-300">Claude (Anthropic)</span> ou{' '}
            <span className="text-slate-300">ChatGPT (OpenAI)</span>, conforme sua preferência — e cadastre a chave.
          </p>
          {isAdmin ? (
            <Link href="/app/configuracoes"
              className="mt-5 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-medium px-4 py-2.5 rounded-xl transition">
              <Settings className="w-4 h-4"/> Ir para Configurações → IA
            </Link>
          ) : (
            <p className="mt-5 text-xs text-slate-500">
              Peça a um administrador da empresa para cadastrar a chave em Configurações → IA.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full max-h-screen">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900 px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${accent}20`, border: `1px solid ${accent}40` }}>
            <Bot className="w-4 h-4" style={{ color: accent }}/>
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-white">{persona}</h1>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"/>
              Online · {settings?.ai_model || DEFAULT_MODEL.openai} · Base de conhecimento carregada
            </p>
          </div>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition">
              <RotateCcw className="w-3.5 h-3.5"/> Nova conversa
            </button>
          )}
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto pt-6">
            {/* Welcome */}
            <div className="flex gap-3 mb-6">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: `${accent}20`, border: `1px solid ${accent}40` }}>
                <Bot className="w-4 h-4" style={{ color: accent }}/>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-300 leading-relaxed max-w-lg">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{welcome}</ReactMarkdown>
              </div>
            </div>

            {/* Sugestões */}
            {suggestions.length > 0 && (
              <div>
                <p className="text-xs text-slate-600 mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3"/> Perguntas frequentes
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => send(s)}
                      className="flex items-center gap-2 text-left text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white px-4 py-3 rounded-xl transition group">
                      <ChevronRight className="w-3 h-3 shrink-0 text-slate-600 group-hover:text-amber-400 transition"/>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Info RAG */}
            <div className="mt-6 flex items-center gap-2 text-xs text-slate-600 justify-center">
              <BookOpen className="w-3 h-3"/>
              Respostas baseadas na base de conhecimento da empresa
            </div>
          </div>
        )}

        {/* Histórico de mensagens */}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 max-w-3xl mx-auto ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
              msg.role === 'user'
                ? 'bg-slate-700 text-slate-300'
                : 'text-white'
            }`} style={msg.role === 'assistant' ? { background: `${accent}30`, border: `1px solid ${accent}50` } : {}}>
              {msg.role === 'user'
                ? (user?.name?.charAt(0) || 'U')
                : <Bot className="w-3.5 h-3.5" style={{ color: accent }}/>
              }
            </div>

            {/* Balão */}
            <div className={`group relative flex-1 ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-amber-500/15 border border-amber-500/20 text-white max-w-md rounded-tr-sm'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-sm'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="prose-nexus text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : msg.content}
              </div>

              {/* Copiar (só assistente) */}
              {msg.role === 'assistant' && (
                <button onClick={() => copyMessage(msg.content, i)}
                  className="absolute -bottom-5 left-0 opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-400 transition">
                  {copied === i ? <><CheckCheck className="w-3 h-3 text-green-400"/> Copiado</> : <><Copy className="w-3 h-3"/> Copiar</>}
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Loading */}
        {loading && (
          <div className="flex gap-3 max-w-3xl mx-auto">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `${accent}30`, border: `1px solid ${accent}50` }}>
              <Bot className="w-3.5 h-3.5" style={{ color: accent }}/>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}/>
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div className="border-t border-slate-800 bg-slate-900/80 backdrop-blur px-4 py-4 shrink-0">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          <div className="flex-1 bg-slate-800 border border-slate-700 focus-within:border-amber-500 rounded-2xl transition">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }}}
              placeholder="Digite sua pergunta... (Enter para enviar)"
              rows={1}
              className="w-full bg-transparent px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none resize-none max-h-32"
              style={{ minHeight: '44px' }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 128) + 'px'
              }}
            />
          </div>
          <button onClick={() => send()} disabled={loading || !input.trim()}
            className="w-11 h-11 flex items-center justify-center rounded-xl text-onaccent font-semibold transition disabled:opacity-40 shrink-0"
            style={{ background: input.trim() && !loading ? accent : '#64748b' }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-white"/> : <Send className="w-4 h-4"/>}
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-700 mt-2">
          Respostas baseadas nos documentos da empresa · Sempre valide informações críticas com o responsável
        </p>
      </div>
    </div>
  )
}
