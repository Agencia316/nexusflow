'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { useFirm } from '@/lib/firm-context'
import { useRouter } from 'next/navigation'
import { BarChart3, CheckCircle2, PenLine, Clock, Users, FileText, TrendingUp } from 'lucide-react'

export default function ReportsPage() {
  const user = getUser()
  const router = useRouter()
  const { firmId } = useFirm()
  const [data, setData] = useState<any>({ users: [], docs: [], progress: [], assignments: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.role === 'member') { router.push('/app/dashboard'); return }
    async function load() {
      const [usersRes, docsRes, progressRes, assignRes] = await Promise.all([
        supabase.from('nf_users').select('*').eq('firm_id', firmId),
        supabase.from('nf_documents').select('id,title,status,requires_reading,requires_signature,view_count').eq('firm_id', firmId),
        supabase.from('nf_user_progress').select('*'),
        supabase.from('nf_assignments').select('*'),
      ])
      setData({
        users: usersRes.data || [],
        docs: docsRes.data || [],
        progress: progressRes.data || [],
        assignments: assignRes.data || [],
      })
      setLoading(false)
    }
    load()
  }, [firmId])

  const totalReads = data.progress.filter((p: any) => p.read_at).length
  const totalSigns = data.progress.filter((p: any) => p.signed_at).length
  const publishedDocs = data.docs.filter((d: any) => d.status === 'published').length

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Relatórios de Treinamento</h1>
        <p className="text-slate-400 text-sm mt-1">Acompanhe o progresso da equipe em tempo real</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Documentos publicados', value: publishedDocs, icon: FileText, color: 'text-blue-400 bg-blue-400/10' },
          { label: 'Leituras confirmadas', value: totalReads, icon: CheckCircle2, color: 'text-green-400 bg-green-400/10' },
          { label: 'Assinaturas digitais', value: totalSigns, icon: PenLine, color: 'text-amber-400 bg-amber-400/10' },
          { label: 'Membros ativos', value: data.users.filter((u: any) => u.is_active).length, icon: Users, color: 'text-purple-400 bg-purple-400/10' },
        ].map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className={`w-9 h-9 rounded-lg ${k.color} flex items-center justify-center mb-3`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-white">{loading ? '—' : k.value}</p>
              <p className="text-xs text-slate-400 mt-1">{k.label}</p>
            </div>
          )
        })}
      </div>

      {/* Progresso por membro */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" /> Progresso por Membro
        </h2>
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-slate-800 rounded-lg animate-pulse" />)}</div>
        ) : (
          <div className="space-y-3">
            {data.users.map((user: any) => {
              const userProgress = data.progress.filter((p: any) => p.user_id === user.id)
              const reads = userProgress.filter((p: any) => p.read_at).length
              const signs = userProgress.filter((p: any) => p.signed_at).length
              const requiredDocs = data.docs.filter((d: any) => d.requires_reading || d.requires_signature).length
              const pct = requiredDocs > 0 ? Math.round((reads / requiredDocs) * 100) : 0

              return (
                <div key={user.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-800 transition">
                  <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-sm font-bold text-amber-400 shrink-0">
                    {user.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-white">{user.name}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="text-green-400">{reads} leituras</span>
                        <span className="text-amber-400">{signs} assinaturas</span>
                        <span className="font-medium text-white">{pct}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5">
                      <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Documentos mais vistos */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-slate-400" /> Documentos Mais Acessados
        </h2>
        <div className="space-y-2">
          {[...data.docs].sort((a: any, b: any) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 8).map((doc: any) => {
            const reads = data.progress.filter((p: any) => p.document_id === doc.id && p.read_at).length
            const signs = data.progress.filter((p: any) => p.document_id === doc.id && p.signed_at).length
            return (
              <div key={doc.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-800 transition">
                <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="flex-1 text-sm text-slate-300 truncate">{doc.title}</span>
                <div className="flex items-center gap-3 text-xs shrink-0">
                  <span className="text-slate-500">{doc.view_count} views</span>
                  {doc.requires_reading && <span className="text-green-400">{reads} ✓</span>}
                  {doc.requires_signature && <span className="text-amber-400">{signs} ✍️</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
