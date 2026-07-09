'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { useFirm } from '@/lib/firm-context'
import { useRouter } from 'next/navigation'
import {
  GraduationCap, ChevronRight, CheckCircle2, Clock, Lock,
  Trophy, Plus, Pencil, Trash2, X, Save, Loader2,
  ChevronUp, ChevronDown, Brain, AlertCircle,
  ToggleLeft, ToggleRight, Sparkles, RefreshCw
} from 'lucide-react'

interface Path { id:string; title:string; description:string; target_role_ids:string[]; is_active:boolean }
interface Step { id?:string; path_id?:string; title:string; description:string; document_id:string; step_order:number; quiz_json:any }
interface Doc   { id:string; title:string }
interface Role  { id:string; name:string; access_level:string }

export default function TrainingPage() {
  const user   = getUser()
  const router = useRouter()
  const { firmId } = useFirm()
  const canEdit = user?.role === 'admin' || user?.role === 'editor'

  const [paths,       setPaths]       = useState<Path[]>([])
  const [stepsMap,    setStepsMap]    = useState<Record<string,Step[]>>({})
  const [progressMap, setProgressMap] = useState<Record<string,any[]>>({})
  const [certs,       setCerts]       = useState<string[]>([])
  const [docs,        setDocs]        = useState<Doc[]>([])
  const [roles,       setRoles]       = useState<Role[]>([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [mode,        setMode]        = useState<'list'|'new'|'edit'>('list')
  const [editPath,    setEditPath]    = useState<Path|null>(null)
  const [editSteps,   setEditSteps]   = useState<Partial<Step>[]>([])
  const [pathForm,    setPathForm]    = useState({ title:'', description:'', target_role_ids:[] as string[], is_active:true })
  const [deleteConfirm, setDeleteConfirm] = useState<string|null>(null)
  const [quizGenIdx,  setQuizGenIdx]  = useState<number|null>(null)
  const [quizOpenIdx, setQuizOpenIdx] = useState<number|null>(null)

  const load = useCallback(async () => {
    const [pathsRes, progressRes, certRes, docsRes, rolesRes] = await Promise.all([
      supabase.from('nf_training_paths').select('*').eq('firm_id', firmId).order('created_at'),
      user ? supabase.from('nf_user_progress').select('*').eq('user_id', user.id) : { data:[] },
      user ? supabase.from('nf_certificates').select('path_id').eq('user_id', user.id) : { data:[] },
      supabase.from('nf_documents').select('id,title').eq('firm_id', firmId).eq('status','published').order('title'),
      supabase.from('nf_roles').select('*').eq('firm_id', firmId).order('sort_order'),
    ])

    // nf_training_steps não tem firm_id: escopo vem das trilhas da firma. Sem o
    // .in(), o super-admin (que atravessa o RLS) traria as etapas de todas as firmas.
    const pathIds = (pathsRes.data || []).map((p: any) => p.id)
    const stepsRes = pathIds.length
      ? await supabase.from('nf_training_steps').select('*').in('path_id', pathIds).order('step_order')
      : { data: [] as any[] }
    const sMap: Record<string,Step[]> = {}
    for (const s of (stepsRes.data||[])) {
      if (!sMap[s.path_id]) sMap[s.path_id] = []
      sMap[s.path_id].push(s)
    }
    const pMap: Record<string,any[]> = {}
    for (const p of (progressRes.data||[])) {
      if (!pMap[p.step_id]) pMap[p.step_id] = []
      pMap[p.step_id].push(p)
    }
    setPaths(pathsRes.data||[])
    setStepsMap(sMap)
    setProgressMap(pMap)
    setCerts((certRes.data||[]).map((c:any)=>c.path_id))
    setDocs(docsRes.data||[])
    setRoles(rolesRes.data||[])
    setLoading(false)
  }, [firmId])

  useEffect(() => { load() }, [load])

  function getProgress(pathId:string) {
    const steps = stepsMap[pathId]||[]
    if (!steps.length) return { done:0, total:0, pct:0 }
    const done = steps.filter(s => (progressMap[s.id!]||[]).some((p:any)=>p.completed_at)).length
    return { done, total:steps.length, pct:Math.round((done/steps.length)*100) }
  }

  // Filtrar trilhas por cargo do usuário
  function pathVisibleToUser(path:Path) {
    if (canEdit) return true // admin/editor vê tudo
    if (!path.is_active) return false
    if (!path.target_role_ids?.length) return true // sem restrição = todos
    if (!user?.job_role_id) return true // usuário sem cargo vê todas
    return path.target_role_ids.includes(user.job_role_id)
  }

  function openNew() {
    setEditPath(null)
    setPathForm({ title:'', description:'', target_role_ids:[], is_active:true })
    setEditSteps([{ title:'', description:'', document_id:'', step_order:1, quiz_json:null }])
    setQuizOpenIdx(null)
    setMode('new')
  }

  function openEdit(path:Path) {
    setEditPath(path)
    setPathForm({ title:path.title, description:path.description, target_role_ids:path.target_role_ids||[], is_active:path.is_active })
    const steps = [...(stepsMap[path.id]||[])].sort((a,b)=>a.step_order-b.step_order)
    setEditSteps(steps.map(s=>({...s})))
    setQuizOpenIdx(null)
    setMode('edit')
  }

  function toggleTargetRole(roleId:string) {
    setPathForm(f => ({
      ...f,
      target_role_ids: f.target_role_ids.includes(roleId)
        ? f.target_role_ids.filter(r=>r!==roleId)
        : [...f.target_role_ids, roleId]
    }))
  }

  async function savePath() {
    if (!pathForm.title.trim()) { alert('Informe o título da trilha.'); return }
    if (editSteps.length === 0) { alert('Adicione ao menos uma etapa.'); return }
    if (editSteps.some(s => !s.title?.trim() || !s.document_id)) {
      alert('Todas as etapas precisam de título e documento.'); return
    }
    setSaving(true)
    try {
      let pathId = editPath?.id
      const pathData = {
        firm_id: firmId,
        title: pathForm.title.trim(),
        description: pathForm.description.trim(),
        target_role_ids: pathForm.target_role_ids,
        is_active: pathForm.is_active,
      }
      if (mode === 'new') {
        const { data, error } = await supabase.from('nf_training_paths').insert(pathData).select().single()
        if (error) throw error
        pathId = data.id
      } else {
        await supabase.from('nf_training_paths').update(pathData).eq('id', pathId)
        await supabase.from('nf_training_steps').delete().eq('path_id', pathId)
      }
      const stepsToInsert = editSteps.map((s, i) => ({
        path_id: pathId,
        title: s.title!.trim(),
        description: (s.description||'').trim(),
        document_id: s.document_id,
        step_order: i + 1,
        quiz_json: s.quiz_json?.questions?.length && s.quiz_json.questions.some((q:any)=>q.q.trim()) ? s.quiz_json : null,
      }))
      await supabase.from('nf_training_steps').insert(stepsToInsert)
      await load()
      setMode('list')
    } catch(e:any) {
      alert('Erro ao salvar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function deletePath(pathId:string) {
    setSaving(true)
    await supabase.from('nf_training_steps').delete().eq('path_id', pathId)
    await supabase.from('nf_certificates').delete().eq('path_id', pathId)
    await supabase.from('nf_training_paths').delete().eq('id', pathId)
    await load()
    setDeleteConfirm(null)
    setSaving(false)
  }

  // Gerar quiz com IA
  async function generateQuizAI(si:number) {
    const step = editSteps[si]
    if (!step.document_id) { alert('Selecione um documento primeiro.'); return }
    setQuizGenIdx(si)
    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: step.document_id, firmId, count: 4 }),
      })
      const data = await res.json()
      if (data.quiz) {
        updateStep(si, 'quiz_json', data.quiz)
        setQuizOpenIdx(si)
      } else {
        alert('Erro ao gerar quiz: ' + (data.error || 'Tente novamente'))
      }
    } catch(e) {
      alert('Erro de conexão ao gerar quiz.')
    } finally {
      setQuizGenIdx(null)
    }
  }

  // Step helpers
  function addStep() { setEditSteps(prev => [...prev, { title:'', description:'', document_id:'', step_order:prev.length+1, quiz_json:null }]) }
  function removeStep(i:number) { setEditSteps(prev => prev.filter((_,idx)=>idx!==i)); if (quizOpenIdx===i) setQuizOpenIdx(null) }
  function moveStep(i:number, dir:-1|1) {
    setEditSteps(prev => {
      const arr=[...prev]; const j=i+dir
      if(j<0||j>=arr.length) return arr
      ;[arr[i],arr[j]]=[arr[j],arr[i]]; return arr
    })
    if (quizOpenIdx===i) setQuizOpenIdx(i+dir)
    else if (quizOpenIdx===i+dir) setQuizOpenIdx(i)
  }
  function updateStep(i:number, field:string, value:any) {
    setEditSteps(prev => prev.map((s,idx)=>idx===i?{...s,[field]:value}:s))
  }

  // Quiz helpers
  function updateQuestion(si:number, qi:number, field:string, value:any) {
    const quiz=JSON.parse(JSON.stringify(editSteps[si].quiz_json||{questions:[]}))
    quiz.questions[qi][field]=value; updateStep(si,'quiz_json',quiz)
  }
  function updateOption(si:number, qi:number, oi:number, value:string) {
    const quiz=JSON.parse(JSON.stringify(editSteps[si].quiz_json||{questions:[]}))
    quiz.questions[qi].options[oi]=value; updateStep(si,'quiz_json',quiz)
  }
  function addQuestion(si:number) {
    const quiz=JSON.parse(JSON.stringify(editSteps[si].quiz_json||{questions:[]}))
    quiz.questions.push({q:'',options:['','','',''],answer:0}); updateStep(si,'quiz_json',quiz)
  }
  function removeQuestion(si:number, qi:number) {
    const quiz=JSON.parse(JSON.stringify(editSteps[si].quiz_json))
    quiz.questions.splice(qi,1)
    updateStep(si,'quiz_json',quiz.questions.length?quiz:null)
    if (!quiz.questions.length) setQuizOpenIdx(null)
  }

  if (loading) return <div className="p-6 space-y-4">{[1,2,3].map(i=><div key={i} className="h-32 bg-slate-900 rounded-xl animate-pulse"/>)}</div>

  // ── LISTA ──
  if (mode==='list') return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Trilhas de Treinamento</h1>
          <p className="text-slate-400 text-sm mt-1">
            {canEdit ? 'Gerencie e atribua trilhas por cargo.' : 'Complete as trilhas do seu cargo para receber o certificado.'}
          </p>
        </div>
        {canEdit && (
          <button onClick={openNew} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-onaccent font-semibold px-4 py-2 rounded-xl text-sm transition">
            <Plus className="w-4 h-4"/> Nova Trilha
          </button>
        )}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-white mb-2">Excluir trilha?</h3>
            <p className="text-sm text-slate-400 mb-5">Todo o progresso e certificados serão perdidos.</p>
            <div className="flex gap-3">
              <button onClick={()=>setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition">Cancelar</button>
              <button onClick={()=>deletePath(deleteConfirm!)} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-semibold disabled:opacity-50 transition">
                {saving?<Loader2 className="w-4 h-4 animate-spin mx-auto"/>:'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {paths.filter(pathVisibleToUser).map(path => {
          const {done, total, pct} = getProgress(path.id)
          const hasCert   = certs.includes(path.id)
          const isComplete = done===total&&total>0
          const pathRoles = roles.filter(r => (path.target_role_ids||[]).includes(r.id))

          return (
            <div key={path.id} className={`bg-slate-900 border rounded-xl overflow-hidden transition ${!path.is_active?'opacity-40 border-slate-800':'border-slate-800 hover:border-slate-700'}`}>
              <div className="p-5 flex items-start gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  hasCert?'bg-amber-500/20 border border-amber-500/30':
                  isComplete?'bg-green-500/15 border border-green-500/30':
                  'bg-blue-500/10 border border-blue-500/20'}`}>
                  {hasCert?<Trophy className="w-5 h-5 text-amber-400"/>:
                   isComplete?<CheckCircle2 className="w-5 h-5 text-green-400"/>:
                   <GraduationCap className="w-5 h-5 text-blue-400"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h2 className="font-semibold text-white text-sm">{path.title}</h2>
                    {!path.is_active && <span className="text-[10px] bg-slate-800 text-slate-500 border border-slate-700 px-2 py-0.5 rounded-full">Inativa</span>}
                    {hasCert && <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">🏆 Certificado</span>}
                  </div>
                  {path.description && <p className="text-xs text-slate-400 mb-2">{path.description}</p>}
                  {/* Cargos alvo */}
                  {pathRoles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {pathRoles.map(r => (
                        <span key={r.id} className="text-[10px] bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded-full">{r.name}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full transition-all ${hasCert?'bg-amber-500':isComplete?'bg-green-500':'bg-blue-500'}`} style={{width:`${pct}%`}}/>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{done}/{total} · {pct}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canEdit && (
                    <>
                      <button onClick={()=>openEdit(path)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-xs transition">
                        <Pencil className="w-3 h-3"/> Editar
                      </button>
                      <button onClick={()=>setDeleteConfirm(path.id)}
                        className="p-2 rounded-lg border border-slate-800 text-slate-600 hover:text-red-400 hover:border-red-400/30 transition">
                        <Trash2 className="w-3 h-3"/>
                      </button>
                    </>
                  )}
                  {path.is_active && (
                    <button onClick={()=>router.push(`/app/training/${path.id}`)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        isComplete?'bg-green-400/10 border border-green-400/20 text-green-400':'bg-amber-500 hover:bg-amber-400 text-onaccent'}`}>
                      {isComplete?'Ver':done>0?'Continuar':'Iniciar'}
                      <ChevronRight className="w-3.5 h-3.5"/>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {paths.filter(pathVisibleToUser).length===0 && (
          <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-xl">
            <GraduationCap className="w-10 h-10 text-slate-700 mx-auto mb-3"/>
            <p className="text-slate-400">Nenhuma trilha disponível para o seu cargo.</p>
          </div>
        )}
      </div>

      {/* Resumo */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          { label:'Disponíveis', value:paths.filter(pathVisibleToUser).length, color:'text-blue-400' },
          { label:'Concluídas',  value:paths.filter(p=>{const{done,total}=getProgress(p.id);return done===total&&total>0}).length, color:'text-green-400' },
          { label:'Certificados',value:certs.length, color:'text-amber-400' },
        ].map(s=>(
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )

  // ── CRIAR / EDITAR ──
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">{mode==='new'?'Nova Trilha':`Editar: ${editPath?.title}`}</h1>
          <p className="text-xs text-slate-500 mt-1">Configure etapas, documentos e quizzes.</p>
        </div>
        <button onClick={()=>setMode('list')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-sm transition">
          <X className="w-4 h-4"/> Cancelar
        </button>
      </div>

      {/* Dados da trilha */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-5 space-y-4">
        <h2 className="text-sm font-semibold text-white border-b border-slate-800 pb-3">Dados da Trilha</h2>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Título *</label>
          <input value={pathForm.title} onChange={e=>setPathForm(p=>({...p,title:e.target.value}))}
            placeholder="Ex: Onboarding — SDR de Captação"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"/>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Descrição</label>
          <textarea value={pathForm.description} onChange={e=>setPathForm(p=>({...p,description:e.target.value}))}
            placeholder="Objetivo desta trilha..." rows={2}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition resize-none"/>
        </div>
        {/* Cargos alvo */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">Cargos que devem fazer esta trilha</label>
          <div className="flex flex-wrap gap-2">
            {roles.map(r => {
              const sel = pathForm.target_role_ids.includes(r.id)
              return (
                <button key={r.id} type="button" onClick={()=>toggleTargetRole(r.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs transition ${
                    sel?'bg-amber-500/15 border-amber-500/30 text-amber-400':'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                  {sel && <CheckCircle2 className="w-3 h-3"/>}
                  {r.name}
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-slate-600 mt-1.5">Sem seleção = visível para todos os cargos</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Status da trilha</span>
          <button onClick={()=>setPathForm(p=>({...p,is_active:!p.is_active}))}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition ${
              pathForm.is_active?'bg-green-500/10 border-green-500/30 text-green-400':'bg-slate-800 border-slate-700 text-slate-400'}`}>
            {pathForm.is_active?<><ToggleRight className="w-4 h-4"/> Ativa</>:<><ToggleLeft className="w-4 h-4"/> Inativa</>}
          </button>
        </div>
      </div>

      {/* Etapas */}
      <div className="space-y-4 mb-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Etapas ({editSteps.length})</h2>
          <button onClick={addStep}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition">
            <Plus className="w-3.5 h-3.5"/> Adicionar etapa
          </button>
        </div>

        {editSteps.map((step, si) => {
          const hasQuiz = !!step.quiz_json?.questions?.length
          const quiz    = step.quiz_json
          const isOpen  = quizOpenIdx === si

          return (
            <div key={si} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {/* Header etapa */}
              <div className="px-4 py-3 bg-slate-900/80 border-b border-slate-800 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-onaccent font-bold text-xs shrink-0">{si+1}</div>
                <span className="flex-1 text-xs text-slate-400 font-medium truncate">{step.title||`Etapa ${si+1}`}</span>
                <div className="flex items-center gap-1">
                  <button onClick={()=>moveStep(si,-1)} disabled={si===0} className="p-1.5 rounded text-slate-600 hover:text-slate-300 disabled:opacity-20"><ChevronUp className="w-3.5 h-3.5"/></button>
                  <button onClick={()=>moveStep(si,1)} disabled={si===editSteps.length-1} className="p-1.5 rounded text-slate-600 hover:text-slate-300 disabled:opacity-20"><ChevronDown className="w-3.5 h-3.5"/></button>
                  <button onClick={()=>removeStep(si)} className="p-1.5 rounded text-slate-600 hover:text-red-400 ml-1"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Título da etapa *</label>
                  <input value={step.title||''} onChange={e=>updateStep(si,'title',e.target.value)}
                    placeholder="Ex: Aprenda o script de captação"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"/>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Documento de leitura *</label>
                  <select value={step.document_id||''} onChange={e=>updateStep(si,'document_id',e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition">
                    <option value="">— Selecione um documento —</option>
                    {docs.map(d=><option key={d.id} value={d.id}>{d.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Descrição (opcional)</label>
                  <input value={step.description||''} onChange={e=>updateStep(si,'description',e.target.value)}
                    placeholder="Objetivo ou dica para esta etapa"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"/>
                </div>

                {/* Quiz */}
                <div className="pt-2 border-t border-slate-800">
                  {!hasQuiz ? (
                    <div className="flex gap-2">
                      <button onClick={()=>{ updateStep(si,'quiz_json',{questions:[{q:'',options:['','','',''],answer:0}]}); setQuizOpenIdx(si) }}
                        className="flex-1 flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-xl border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600 transition">
                        <Brain className="w-3.5 h-3.5"/> Criar quiz manualmente
                      </button>
                      {step.document_id && (
                        <button onClick={()=>generateQuizAI(si)} disabled={quizGenIdx===si}
                          className="flex-1 flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition disabled:opacity-50">
                          {quizGenIdx===si?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Sparkles className="w-3.5 h-3.5"/>}
                          {quizGenIdx===si?'Gerando...':'Gerar com IA'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <button onClick={()=>setQuizOpenIdx(isOpen?null:si)}
                          className="flex items-center gap-2 text-xs text-purple-400 hover:text-purple-300 transition font-medium">
                          <Brain className="w-3.5 h-3.5"/>
                          Quiz ({quiz.questions.length} pergunta{quiz.questions.length!==1?'s':''})
                          {isOpen?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>}
                        </button>
                        <div className="flex items-center gap-2">
                          {step.document_id && (
                            <button onClick={()=>generateQuizAI(si)} disabled={quizGenIdx===si}
                              className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 transition disabled:opacity-50">
                              {quizGenIdx===si?<Loader2 className="w-3 h-3 animate-spin"/>:<RefreshCw className="w-3 h-3"/>}
                              Regenerar
                            </button>
                          )}
                          <button onClick={()=>{ updateStep(si,'quiz_json',null); setQuizOpenIdx(null) }}
                            className="text-[11px] text-slate-600 hover:text-red-400 transition">Remover quiz</button>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="space-y-4 bg-slate-800/40 border border-slate-700 rounded-xl p-4">
                          {quiz.questions.map((q:any, qi:number) => (
                            <div key={qi} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-purple-400">Pergunta {qi+1}</span>
                                {quiz.questions.length>1 && (
                                  <button onClick={()=>removeQuestion(si,qi)} className="text-[11px] text-slate-600 hover:text-red-400">Remover</button>
                                )}
                              </div>
                              <input value={q.q} onChange={e=>updateQuestion(si,qi,'q',e.target.value)}
                                placeholder="Digite a pergunta..."
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 transition"/>
                              <div className="space-y-2">
                                <p className="text-[11px] text-slate-500">Opções — clique no círculo para marcar a correta:</p>
                                {q.options.map((opt:string, oi:number) => (
                                  <div key={oi} className="flex items-center gap-2">
                                    <button onClick={()=>updateQuestion(si,qi,'answer',oi)}
                                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                                        q.answer===oi?'border-green-400 bg-green-400':'border-slate-600 hover:border-slate-400'}`}>
                                      {q.answer===oi && <CheckCircle2 className="w-3 h-3 text-onaccent"/>}
                                    </button>
                                    <input value={opt} onChange={e=>updateOption(si,qi,oi,e.target.value)}
                                      placeholder={`Opção ${String.fromCharCode(65+oi)}`}
                                      className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 transition"/>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                          <button onClick={()=>addQuestion(si)}
                            className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-xl border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600 transition">
                            <Plus className="w-3 h-3"/> Adicionar pergunta
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {editSteps.length===0 && (
          <button onClick={addStep} className="w-full flex items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-400 text-sm transition">
            <Plus className="w-4 h-4"/> Adicionar primeira etapa
          </button>
        )}
      </div>

      {/* Footer fixo */}
      <div className="flex items-center gap-3 sticky bottom-0 bg-slate-950/90 backdrop-blur py-4 border-t border-slate-800 -mx-6 px-6">
        <button onClick={()=>setMode('list')} className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition">Cancelar</button>
        <button onClick={savePath} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-onaccent font-semibold py-2.5 rounded-xl text-sm transition">
          {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}
          {mode==='new'?'Criar Trilha':'Salvar Alterações'}
        </button>
      </div>
    </div>
  )
}
