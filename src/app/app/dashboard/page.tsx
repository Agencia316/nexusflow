'use client'
import { useEffect, useState } from 'react'
import { supabase, FIRM_ID } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import {
  FileText, Users, GraduationCap, MessageSquareText,
  CheckCircle2, AlertCircle, Plus, ChevronRight,
  BookOpen, Trophy, PenLine, Bell, TrendingUp
} from 'lucide-react'

export default function Dashboard() {
  const router = useRouter()
  const user = getUser()
  const [stats, setStats] = useState({
    docs: 0, published: 0, users: 0, categories: 0,
    paths: 0, steps_done: 0, steps_total: 0,
    alerts_unread: 0, reads_pending: 0, signs_pending: 0,
  })
  const [recentDocs, setRecentDocs] = useState<any[]>([])
  const [myProgress, setMyProgress] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [
        docsRes, usersRes, catsRes, recentRes,
        pathsRes, progressRes, alertsRes
      ] = await Promise.all([
        supabase.from('nf_documents').select('status,requires_reading,requires_signature').eq('firm_id', FIRM_ID),
        supabase.from('nf_users').select('id').eq('firm_id', FIRM_ID).eq('is_active', true),
        supabase.from('nf_categories').select('id').eq('firm_id', FIRM_ID),
        supabase.from('nf_documents').select('id,title,status,updated_at,view_count,requires_reading,requires_signature').eq('firm_id', FIRM_ID).eq('status','published').order('updated_at',{ascending:false}).limit(6),
        supabase.from('nf_training_paths').select('id').eq('firm_id', FIRM_ID).eq('is_active', true),
        user ? supabase.from('nf_user_progress').select('*,step:step_id(title,path_id)').eq('user_id', user.id) : { data: [] },
        user ? supabase.from('nf_alerts').select('id').eq('firm_id', FIRM_ID).eq('user_id', user.id).is('read_at', null) : { data: [] },
      ])

      const docs = docsRes.data || []
      const progData = progressRes.data || []
      const stepsTotal = progData.length
      const stepsDone = progData.filter((p:any) => p.completed_at).length

      // Docs que exigem ação do usuário
      const readDocs = docs.filter((d:any) => d.requires_reading)
      const signDocs = docs.filter((d:any) => d.requires_signature)
      const readsDone = progData.filter((p:any) => p.read_at).length
      const signsDone = progData.filter((p:any) => p.signed_at).length

      setStats({
        docs: docs.length,
        published: docs.filter((d:any) => d.status === 'published').length,
        users: (usersRes.data||[]).length,
        categories: (catsRes.data||[]).length,
        paths: (pathsRes.data||[]).length,
        steps_done: stepsDone,
        steps_total: stepsTotal,
        alerts_unread: (alertsRes.data||[]).length,
        reads_pending: Math.max(0, readDocs.length - readsDone),
        signs_pending: Math.max(0, signDocs.length - signsDone),
      })
      setRecentDocs(recentRes.data || [])
      setMyProgress(progData)
      setLoading(false)
    }
    load()
  }, [])

  const progressPct = stats.steps_total > 0
    ? Math.round((stats.steps_done / stats.steps_total) * 100) : 0

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"/>
        <p className="text-slate-400 text-sm">Carregando dashboard...</p>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Olá, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Alertas pendentes */}
      {(stats.alerts_unread > 0 || stats.reads_pending > 0 || stats.signs_pending > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {stats.alerts_unread > 0 && (
            <button onClick={() => router.push('/app/alertas')}
              className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-left hover:bg-amber-500/15 transition">
              <Bell className="w-5 h-5 text-amber-400 shrink-0"/>
              <div>
                <p className="text-sm font-semibold text-amber-400">{stats.alerts_unread} alerta{stats.alerts_unread>1?'s':''} não lido{stats.alerts_unread>1?'s':''}</p>
                <p className="text-xs text-slate-500">Clique para ver</p>
              </div>
            </button>
          )}
          {stats.reads_pending > 0 && (
            <button onClick={() => router.push('/app/docs')}
              className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-left hover:bg-blue-500/15 transition">
              <BookOpen className="w-5 h-5 text-blue-400 shrink-0"/>
              <div>
                <p className="text-sm font-semibold text-blue-400">{stats.reads_pending} leitura{stats.reads_pending>1?'s':''} pendente{stats.reads_pending>1?'s':''}</p>
                <p className="text-xs text-slate-500">Documentos obrigatórios</p>
              </div>
            </button>
          )}
          {stats.signs_pending > 0 && (
            <button onClick={() => router.push('/app/docs')}
              className="flex items-center gap-3 bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 text-left hover:bg-purple-500/15 transition">
              <PenLine className="w-5 h-5 text-purple-400 shrink-0"/>
              <div>
                <p className="text-sm font-semibold text-purple-400">{stats.signs_pending} assinatura{stats.signs_pending>1?'s':''} pendente{stats.signs_pending>1?'s':''}</p>
                <p className="text-xs text-slate-500">Documentos a assinar</p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Documentos', value: stats.published, sub: `${stats.docs} total`, icon: FileText, color: 'blue' },
          { label: 'Equipe', value: stats.users, sub: `${stats.categories} categorias`, icon: Users, color: 'green' },
          { label: 'Trilhas ativas', value: stats.paths, sub: `${stats.steps_done} etapas concluídas`, icon: GraduationCap, color: 'purple' },
          { label: 'DocuChat', value: 'IA', sub: 'Disponível 24/7', icon: MessageSquareText, color: 'amber' },
        ].map(card => {
          const Icon = card.icon
          const colors: Record<string,string> = {
            blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
            green: 'bg-green-500/10 border-green-500/20 text-green-400',
            purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
            amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
          }
          return (
            <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-3 ${colors[card.color]}`}>
                <Icon className="w-5 h-5"/>
              </div>
              <div className="text-2xl font-bold text-white mb-0.5">{card.value}</div>
              <div className="text-xs font-medium text-white mb-0.5">{card.label}</div>
              <div className="text-xs text-slate-500">{card.sub}</div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Meu progresso nas trilhas */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400"/> Meu Progresso
            </h3>
            <button onClick={() => router.push('/app/training')}
              className="text-xs text-amber-400 hover:underline">Ver trilhas</button>
          </div>

          {stats.steps_total === 0 ? (
            <div className="text-center py-6">
              <GraduationCap className="w-8 h-8 text-slate-700 mx-auto mb-2"/>
              <p className="text-xs text-slate-500">Nenhuma trilha iniciada ainda.</p>
              <button onClick={() => router.push('/app/training')}
                className="mt-3 text-xs text-amber-400 hover:underline">Começar agora →</button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400">{stats.steps_done} de {stats.steps_total} etapas</span>
                <span className="text-amber-400 font-semibold">{progressPct}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
                <div className="h-full bg-amber-500 rounded-full transition-all" style={{width:`${progressPct}%`}}/>
              </div>
              {progressPct === 100 && (
                <div className="flex items-center gap-2 text-xs text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2">
                  <Trophy className="w-3.5 h-3.5"/> Todas as trilhas concluídas!
                </div>
              )}
            </>
          )}

          {/* Ações rápidas */}
          <div className="mt-4 space-y-2 border-t border-slate-800 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ações rápidas</p>
            {[
              { label: 'Nova trilha', icon: GraduationCap, href: '/app/training' },
              { label: 'DocuChat', icon: MessageSquareText, href: '/app/chat' },
              ...(user?.role !== 'member' ? [{ label: 'Novo documento', icon: Plus, href: '/app/docs/new' }] : []),
            ].map(a => {
              const Icon = a.icon
              return (
                <button key={a.href} onClick={() => router.push(a.href)}
                  className="w-full flex items-center gap-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-lg transition">
                  <Icon className="w-3.5 h-3.5 text-amber-400"/> {a.label}
                  <ChevronRight className="w-3 h-3 ml-auto text-slate-600"/>
                </button>
              )
            })}
          </div>
        </div>

        {/* Documentos recentes */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400"/> Documentos Recentes
            </h3>
            <button onClick={() => router.push('/app/docs')}
              className="text-xs text-amber-400 hover:underline">Ver todos</button>
          </div>

          {recentDocs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-8 h-8 text-slate-700 mx-auto mb-2"/>
              <p className="text-xs text-slate-500">Nenhum documento ainda.</p>
              {user?.role !== 'member' && (
                <button onClick={() => router.push('/app/docs/new')}
                  className="mt-2 text-xs text-amber-400 hover:underline">Criar o primeiro →</button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {recentDocs.map(doc => (
                <button key={doc.id} onClick={() => router.push(`/app/docs/${doc.id}`)}
                  className="w-full flex items-center gap-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 text-left transition group">
                  <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0 text-sm">
                    📄
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white group-hover:text-amber-300 truncate transition">{doc.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-500">{doc.view_count || 0} visualizações</span>
                      {doc.requires_reading && <span className="text-[10px] text-blue-400">📖 leitura</span>}
                      {doc.requires_signature && <span className="text-[10px] text-amber-400">✍️ assinar</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 shrink-0 transition"/>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
