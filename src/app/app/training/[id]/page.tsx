'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { useFirm } from '@/lib/firm-context'
import { useParams, useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowLeft, CheckCircle2, ChevronRight, GraduationCap,
  Trophy, Loader2, AlertCircle, BookOpen, Brain,
  Download, XCircle, RefreshCw, Lock
} from 'lucide-react'

export default function TrainingDetailPage() {
  const { id: pathId } = useParams()
  const router = useRouter()
  const { firmId } = useFirm()
  const user = getUser()

  const [path, setPath] = useState<any>(null)
  const [steps, setSteps] = useState<any[]>([])
  const [docs, setDocs] = useState<Record<string,any>>({})
  const [progress, setProgress] = useState<Record<string,any>>({})
  const [cert, setCert] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Step ativo — controlado apenas por interação do usuário, não por loadData
  const [activeStep, setActiveStep] = useState<number>(0)

  // Fase do step atual: leitura → quiz → resultado
  const [phase, setPhase] = useState<'reading'|'quiz'|'result'>('reading')

  // Estado do quiz — completamente isolado por step
  const [quizAnswers, setQuizAnswers] = useState<Record<number,number>>({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [quizScore, setQuizScore] = useState<number|null>(null)
  const [saving, setSaving] = useState(false)
  const [generatingCert, setGeneratingCert] = useState(false)

  const loadData = useCallback(async (keepStep?: number) => {
    const [pathRes, stepsRes, certRes] = await Promise.all([
      supabase.from('nf_training_paths').select('*').eq('id', pathId).single(),
      supabase.from('nf_training_steps').select('*').eq('path_id', pathId).order('step_order'),
      user ? supabase.from('nf_certificates').select('*').eq('path_id', pathId).eq('user_id', user.id).maybeSingle() : null,
    ])

    setPath(pathRes.data)
    const stepsData = stepsRes.data || []
    setSteps(stepsData)
    setCert(certRes?.data || null)

    const docIds = stepsData.map((s:any) => s.document_id).filter(Boolean)
    const [docsRes, progRes] = await Promise.all([
      docIds.length ? supabase.from('nf_documents').select('*').in('id', docIds) : { data: [] },
      user ? supabase.from('nf_user_progress').select('*').eq('user_id', user.id).in('step_id', stepsData.map((s:any)=>s.id)) : { data: [] },
    ])

    const dMap: Record<string,any> = {}
    for (const d of (docsRes.data||[])) dMap[d.id] = d
    setDocs(dMap)

    const pMap: Record<string,any> = {}
    for (const p of (progRes.data||[])) pMap[p.step_id] = p
    setProgress(pMap)

    // Na carga inicial, ir para o primeiro step incompleto
    if (keepStep === undefined) {
      const firstIncomplete = stepsData.findIndex((s:any) => !pMap[s.id]?.completed_at)
      setActiveStep(firstIncomplete >= 0 ? firstIncomplete : 0)
    }
    // Se keepStep fornecido, manter o step atual sem alterar

    setLoading(false)
  }, [pathId, user])

  useEffect(() => { loadData() }, [pathId])

  // Ir para um step específico — reseta TODO o estado do quiz
  function goToStep(idx: number) {
    setActiveStep(idx)
    setPhase('reading')
    setQuizAnswers({})
    setQuizSubmitted(false)
    setQuizScore(null)
  }

  // Após confirmar leitura — vai para quiz ou completa
  async function markRead() {
    const step = steps[activeStep]
    if (!user || !step) return
    setSaving(true)

    await supabase.from('nf_user_progress').upsert({
      user_id: user.id,
      document_id: step.document_id,
      step_id: step.id,
      read_at: new Date().toISOString(),
      firm_id: firmId,
    }, { onConflict: 'user_id,step_id' })

    // Recarregar progresso mas manter o step atual
    await loadData(activeStep)
    setSaving(false)

    if (step.quiz_json?.questions?.length > 0) {
      // Tem quiz — ir para fase quiz
      setPhase('quiz')
      setQuizAnswers({})
      setQuizSubmitted(false)
      setQuizScore(null)
    } else {
      // Sem quiz — completar e avançar
      await completeStep(step, undefined, true)
    }
  }

  async function completeStep(step: any, score?: number, autoAdvance = false) {
    if (!user) return
    setSaving(true)

    await supabase.from('nf_user_progress').upsert({
      user_id: user.id,
      document_id: step.document_id,
      step_id: step.id,
      read_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      quiz_score: score ?? null,
      firm_id: firmId,
    }, { onConflict: 'user_id,step_id' })

    // Recarregar progresso mantendo step atual (não deixar loadData mudar o step)
    const stepsData = steps
    const [progRes] = await Promise.all([
      supabase.from('nf_user_progress').select('*').eq('user_id', user.id).in('step_id', stepsData.map((s:any)=>s.id)),
    ])
    const pMap: Record<string,any> = {}
    for (const p of (progRes.data||[])) pMap[p.step_id] = p
    setProgress(pMap)

    setSaving(false)

    // Verificar certificado
    const allDone = stepsData.every(s => pMap[s.id]?.completed_at)
    if (allDone && user && !cert) {
      await generateCertificate(stepsData)
    }

    // Avançar automaticamente para próximo step se autoAdvance
    if (autoAdvance && activeStep < stepsData.length - 1) {
      goToStep(activeStep + 1)
    }
  }

  async function submitQuiz() {
    const step = steps[activeStep]
    const quiz = step?.quiz_json
    if (!quiz || quizSubmitted) return

    const questions = quiz.questions || []
    const correct = questions.filter((_:any, i:number) => quizAnswers[i] === questions[i].answer).length
    const score = Math.round((correct / questions.length) * 100)

    setQuizScore(score)
    setQuizSubmitted(true)
    setPhase('result')

    await completeStep(step, score)

    // Alerta se reprovado
    if (score < 70 && user) {
      await supabase.from('nf_alerts').insert({
        firm_id: firmId,
        user_id: user.id,
        type: 'quiz_failed',
        title: `Quiz: ${score}% em "${step.title}"`,
        message: `Você tirou ${score}% no quiz "${step.title}". Mínimo 70%. Leia novamente e tente de novo.`,
        link: `/app/training/${pathId}`,
      })
    }
  }

  function retryQuiz() {
    setQuizAnswers({})
    setQuizSubmitted(false)
    setQuizScore(null)
    setPhase('quiz')
  }

  async function generateCertificate(stepsData: any[]) {
    if (!user || cert) return
    setGeneratingCert(true)
    const { data } = await supabase.from('nf_certificates').insert({
      user_id: user.id, path_id: pathId,
    }).select().single()
    setCert(data)
    await supabase.from('nf_alerts').insert({
      firm_id: firmId, user_id: user.id, type: 'signed',
      title: `🏆 Trilha concluída: ${path?.title}`,
      message: `Parabéns! Você concluiu a trilha e recebeu seu certificado.`,
      link: `/app/training/${pathId}`,
    })
    setGeneratingCert(false)
  }

  function downloadCert() {
    if (!cert || !user) return
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:'Georgia',serif;background:#0f172a;color:#e8e8e8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
  .cert{max-width:700px;width:100%;background:#1e293b;border:2px solid #d4a017;border-radius:16px;padding:60px 48px;text-align:center;position:relative;}
  .logo{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#d4a017;margin-bottom:32px;}
  h1{font-size:36px;font-weight:400;color:#fff;margin:0 0 8px;}
  h2{font-size:20px;color:#d4a017;margin:0 0 32px;font-weight:400;}
  .name{font-size:28px;font-weight:700;color:#fff;border-bottom:1px solid #334155;padding-bottom:16px;margin-bottom:16px;}
  .desc{color:#94a3b8;font-size:14px;line-height:1.6;margin-bottom:32px;}
  .date{font-size:12px;color:#475569;}
  .seal{font-size:48px;margin-bottom:16px;}
</style></head><body>
<div class="cert">
  <div class="logo">NexusFlow · Certificado de Conclusão</div>
  <div class="seal">🏆</div>
  <h1>Certificado</h1>
  <h2>de Conclusão</h2>
  <div class="name">${user.name}</div>
  <div class="desc">Concluiu com aprovação a trilha de treinamento<br><strong>${path?.title}</strong></div>
  <div class="date">${new Date(cert.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})}</div>
</div>
</body></html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `certificado-${path?.title?.replace(/\s+/g,'-').toLowerCase()}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full py-20">
      <Loader2 className="w-6 h-6 animate-spin text-amber-400"/>
    </div>
  )
  if (!path) return <div className="p-6 text-slate-400">Trilha não encontrada.</div>

  const currentStep = steps[activeStep]
  const currentDoc = currentStep ? docs[currentStep.document_id] : null
  const currentProgress = currentStep ? progress[currentStep.id] : null
  const quiz = currentStep?.quiz_json
  const questions: any[] = quiz?.questions || []

  // Percentual de conclusão
  const completedCount = steps.filter(s => progress[s.id]?.completed_at).length
  const percent = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar de steps */}
      <div className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col shrink-0 overflow-y-auto">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-slate-800">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-3 transition">
            <ArrowLeft className="w-3.5 h-3.5"/> Trilhas
          </button>
          <h2 className="text-sm font-semibold text-white leading-snug">{path.title}</h2>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-500">{completedCount} de {steps.length} concluídas</span>
              <span className="text-amber-400 font-semibold">{percent}%</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${percent}%` }}/>
            </div>
          </div>
        </div>

        {/* Lista de steps */}
        <div className="flex-1 p-3 space-y-1">
          {steps.map((step, idx) => {
            const prog = progress[step.id]
            const isCompleted = !!prog?.completed_at
            const isRead = !!prog?.read_at
            const isActive = idx === activeStep
            const isLocked = idx > 0 && !progress[steps[idx-1]?.id]?.completed_at

            return (
              <button key={step.id}
                onClick={() => !isLocked && goToStep(idx)}
                disabled={isLocked}
                className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition ${
                  isActive ? 'bg-amber-500/15 border border-amber-500/25'
                  : isLocked ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-slate-800 border border-transparent'
                }`}>
                {/* Ícone de status */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                  isCompleted ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : isActive ? 'bg-amber-500 text-slate-950'
                  : isLocked ? 'bg-slate-800 text-slate-600 border border-slate-700'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5"/> :
                   isLocked ? <Lock className="w-3 h-3"/> :
                   idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium leading-snug ${isActive ? 'text-amber-300' : isCompleted ? 'text-slate-400' : 'text-slate-300'}`}>
                    {step.title}
                  </p>
                  {isActive && phase !== 'reading' && (
                    <p className="text-[10px] text-purple-400 mt-0.5 capitalize">{phase === 'quiz' ? '📝 Quiz' : quizScore && quizScore >= 70 ? '✅ Aprovado' : '❌ Reprovado'}</p>
                  )}
                  {prog?.quiz_score != null && (
                    <p className={`text-[10px] mt-0.5 ${prog.quiz_score >= 70 ? 'text-green-400' : 'text-red-400'}`}>
                      Quiz: {prog.quiz_score}%
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Certificado */}
        {cert && (
          <div className="p-3 border-t border-slate-800">
            <button onClick={downloadCert}
              className="w-full flex items-center justify-center gap-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-xs font-semibold py-2.5 rounded-xl transition">
              <Trophy className="w-3.5 h-3.5"/> Baixar Certificado
            </button>
          </div>
        )}
      </div>

      {/* Área principal */}
      <div className="flex-1 overflow-y-auto">
        {!currentStep ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            <p>Selecione uma etapa.</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-6">
            {/* Header do step */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-slate-950 font-bold text-sm shrink-0">
                {activeStep + 1}
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-white">{currentStep.title}</h1>
                {currentStep.description && (
                  <p className="text-sm text-slate-400 mt-0.5">{currentStep.description}</p>
                )}
              </div>
              {/* Indicador de fase */}
              <div className="flex items-center gap-2 shrink-0">
                <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${
                  phase === 'reading' ? 'bg-blue-400/10 text-blue-400 border-blue-400/20'
                  : phase === 'quiz' ? 'bg-purple-400/10 text-purple-400 border-purple-400/20'
                  : quizScore && quizScore >= 70 ? 'bg-green-400/10 text-green-400 border-green-400/20'
                  : 'bg-red-400/10 text-red-400 border-red-400/20'
                }`}>
                  {phase === 'reading' ? <><BookOpen className="w-3 h-3"/> Leitura</>
                   : phase === 'quiz' ? <><Brain className="w-3 h-3"/> Quiz</>
                   : quizScore && quizScore >= 70 ? <><CheckCircle2 className="w-3 h-3"/> Aprovado</>
                   : <><XCircle className="w-3 h-3"/> Reprovado</>}
                </span>
              </div>
            </div>

            {/* ─── FASE: LEITURA ─── */}
            {phase === 'reading' && (
              <>
                {currentDoc ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl mb-6 overflow-hidden">
                    {/* Barra de título do documento */}
                    <div className="flex items-center gap-3 px-6 py-3.5 border-b border-slate-800 bg-slate-800/50">
                      <BookOpen className="w-4 h-4 text-amber-400 shrink-0"/>
                      <span className="text-sm font-medium text-slate-300 truncate">{currentDoc.title}</span>
                    </div>
                    <div className="px-8 py-7">
                      <article className="prose-nexus">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentDoc.content}</ReactMarkdown>
                      </article>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 mb-6 text-center text-slate-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40"/>
                    <p>Documento não encontrado.</p>
                  </div>
                )}

                {/* Botão de ação */}
                {!currentProgress?.completed_at ? (
                  <button onClick={markRead} disabled={saving}
                    className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold py-4 rounded-xl transition text-sm shadow-lg shadow-amber-500/20">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4"/>}
                    {quiz?.questions?.length > 0
                      ? 'Confirmar leitura e ir para o Quiz →'
                      : 'Confirmar leitura e avançar →'}
                  </button>
                ) : currentProgress?.completed_at && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-3">
                      <CheckCircle2 className="w-4 h-4"/>
                      Etapa concluída
                      {currentProgress.quiz_score != null && ` · Quiz: ${currentProgress.quiz_score}%`}
                    </div>
                    {activeStep < steps.length - 1 && (
                      <button onClick={() => goToStep(activeStep + 1)}
                        className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium py-3 rounded-xl transition text-sm">
                        Próxima etapa <ChevronRight className="w-4 h-4"/>
                      </button>
                    )}
                    {activeStep === steps.length - 1 && (
                      <div className="flex items-center justify-center gap-2 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-xl py-3">
                        <Trophy className="w-4 h-4"/> Trilha concluída!
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ─── FASE: QUIZ ─── */}
            {phase === 'quiz' && (
              <div className="space-y-4">
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
                  <p className="text-sm text-purple-400 font-medium flex items-center gap-2">
                    <Brain className="w-4 h-4"/>
                    Quiz · {questions.length} perguntas · Mínimo 70% para aprovação
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Responda todas as perguntas antes de enviar.</p>
                </div>

                {questions.map((q: any, qi: number) => (
                  <div key={qi} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <span className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{qi+1}</span>
                      <p className="text-sm font-semibold text-white leading-relaxed">{q.q}</p>
                    </div>
                    <div className="space-y-2">
                      {q.options.map((opt: string, oi: number) => {
                        const isSelected = quizAnswers[qi] === oi
                        return (
                          <button key={oi}
                            onClick={() => setQuizAnswers(prev => ({ ...prev, [qi]: oi }))}
                            className={`w-full flex items-center gap-3 text-left text-sm px-4 py-2.5 rounded-lg border transition ${
                              isSelected
                                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                            }`}>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold ${
                              isSelected ? 'border-amber-400 bg-amber-400 text-slate-950' : 'border-slate-600 text-slate-500'
                            }`}>
                              {String.fromCharCode(65 + oi)}
                            </div>
                            {opt}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}

                <button onClick={submitQuiz}
                  disabled={Object.keys(quizAnswers).length < questions.length || saving}
                  className="w-full flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-400 disabled:opacity-40 text-white font-semibold py-3.5 rounded-xl transition text-sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Brain className="w-4 h-4"/>}
                  {Object.keys(quizAnswers).length < questions.length
                    ? `Responda todas as perguntas (${Object.keys(quizAnswers).length}/${questions.length})`
                    : 'Enviar respostas'}
                </button>
              </div>
            )}

            {/* ─── FASE: RESULTADO ─── */}
            {phase === 'result' && quizScore !== null && (
              <div className="space-y-4">
                {/* Score card */}
                <div className={`rounded-2xl p-6 border text-center ${
                  quizScore >= 70
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}>
                  <div className="text-5xl font-bold mb-2" style={{ color: quizScore >= 70 ? '#4ade80' : '#f87171' }}>
                    {quizScore}%
                  </div>
                  <p className="font-semibold text-lg mb-1" style={{ color: quizScore >= 70 ? '#4ade80' : '#f87171' }}>
                    {quizScore >= 70 ? '✅ Aprovado!' : '❌ Reprovado — mínimo 70%'}
                  </p>
                  <p className="text-sm text-slate-400">
                    {questions.filter((_:any, i:number) => quizAnswers[i] === questions[i].answer).length} de {questions.length} corretas
                  </p>
                </div>

                {/* Gabarito */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Gabarito</p>
                  <div className="space-y-3">
                    {questions.map((q: any, qi: number) => {
                      const userAns = quizAnswers[qi]
                      const correct = q.answer
                      const isRight = userAns === correct
                      return (
                        <div key={qi} className={`rounded-lg p-3 border ${isRight ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                          <p className="text-xs font-medium text-white mb-2">{qi + 1}. {q.q}</p>
                          <div className="space-y-1">
                            {q.options.map((opt: string, oi: number) => {
                              const isCorrect = oi === correct
                              const isUser = oi === userAns
                              if (!isCorrect && !isUser) return null
                              return (
                                <div key={oi} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
                                  isCorrect ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {isCorrect ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0"/> : <XCircle className="w-3.5 h-3.5 shrink-0"/>}
                                  <span>{String.fromCharCode(65+oi)}. {opt}</span>
                                  {isCorrect && !isRight && isUser === false && <span className="text-slate-500 ml-1">(resposta correta)</span>}
                                  {isUser && !isCorrect && <span className="text-slate-500 ml-1">(sua resposta)</span>}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex gap-3">
                  {quizScore < 70 ? (
                    <>
                      <button onClick={() => setPhase('reading')}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-sm transition">
                        <BookOpen className="w-3.5 h-3.5"/> Reler o documento
                      </button>
                      <button onClick={retryQuiz}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 text-sm transition">
                        <RefreshCw className="w-3.5 h-3.5"/> Tentar novamente
                      </button>
                    </>
                  ) : activeStep < steps.length - 1 ? (
                    <button onClick={() => goToStep(activeStep + 1)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 font-semibold text-sm transition">
                      Próxima etapa <ChevronRight className="w-4 h-4"/>
                    </button>
                  ) : (
                    <div className="flex-1 flex flex-col gap-3">
                      <div className="flex items-center justify-center gap-2 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-xl py-3">
                        <Trophy className="w-4 h-4"/> Trilha concluída! Parabéns!
                      </div>
                      {cert && (
                        <button onClick={downloadCert}
                          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-sm transition hover:bg-amber-500/25">
                          <Download className="w-3.5 h-3.5"/> Baixar Certificado
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
