'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { Bell, CheckCircle2, XCircle, BookOpen, GraduationCap, PenLine, Clock, Loader2 } from 'lucide-react'

const typeConfig: Record<string,any> = {
  assignment: { icon: BookOpen, color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', label: 'Atribuição' },
  overdue: { icon: Clock, color: 'text-red-400 bg-red-400/10 border-red-400/20', label: 'Prazo vencido' },
  new_doc: { icon: BookOpen, color: 'text-green-400 bg-green-400/10 border-green-400/20', label: 'Novo documento' },
  quiz_failed: { icon: XCircle, color: 'text-red-400 bg-red-400/10 border-red-400/20', label: 'Quiz reprovado' },
  signed: { icon: CheckCircle2, color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', label: 'Conquista' },
}

export default function AlertasPage() {
  const user = getUser()
  const router = useRouter()
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState<string|null>(null)

  async function load() {
    if (!user) return
    const { data } = await supabase.from('nf_alerts')
      .select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(50)
    setAlerts(data||[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function markRead(id: string) {
    setMarking(id)
    await supabase.from('nf_alerts').update({ read_at: new Date().toISOString() }).eq('id', id)
    setAlerts(prev => prev.map(a => a.id===id ? {...a, read_at: new Date().toISOString()} : a))
    setMarking(null)
  }

  async function markAllRead() {
    if (!user) return
    await supabase.from('nf_alerts').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null)
    await load()
  }

  const unread = alerts.filter(a => !a.read_at).length

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-amber-400"/> Alertas
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {unread > 0 ? `${unread} não lidos` : 'Todos os alertas lidos'}
          </p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="text-xs text-slate-400 hover:text-white transition px-3 py-1.5 border border-slate-700 rounded-lg hover:border-slate-600">
            Marcar todos como lido
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-16 bg-slate-900 rounded-xl animate-pulse"/>)}</div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-20"/>
          <p>Nenhum alerta ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(alert => {
            const cfg = typeConfig[alert.type] || typeConfig.assignment
            const Icon = cfg.icon
            const isRead = !!alert.read_at
            return (
              <div key={alert.id} className={`flex items-start gap-4 p-4 rounded-xl border transition ${isRead ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-900 border-slate-700'}`}>
                <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${cfg.color}`}>
                  <Icon className="w-4 h-4"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`text-sm font-medium ${isRead ? 'text-slate-400' : 'text-white'}`}>{alert.title}</p>
                      {alert.message && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{alert.message}</p>}
                      <p className="text-[10px] text-slate-600 mt-1">{new Date(alert.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                    {!isRead && (
                      <button onClick={() => markRead(alert.id)} disabled={marking===alert.id}
                        className="text-[10px] text-slate-500 hover:text-white px-2 py-1 border border-slate-700 rounded hover:border-slate-500 transition shrink-0">
                        {marking===alert.id ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Lido'}
                      </button>
                    )}
                  </div>
                  {alert.link && (
                    <button onClick={() => router.push(alert.link)} className="text-xs text-amber-400 hover:underline mt-1">
                      Ver →
                    </button>
                  )}
                </div>
                {!isRead && <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-2"/>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
