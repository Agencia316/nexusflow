'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { useFirm } from '@/lib/firm-context'
import { useParams, useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getToken } from '@/lib/session'
import {
  ArrowLeft, CheckCircle2, PenLine, Download, Share2,
  Tag, Eye, Loader2, MessageCircle, Send, Trash2,
  History, Video, Link as LinkIcon, Lock
} from 'lucide-react'

// Componente de embed de vídeo — detecta YouTube, Vimeo ou URL direta
function VideoEmbed({ url }: { url: string }) {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)

  if (ytMatch) return (
    <div className="relative pb-[56.25%] h-0 rounded-xl overflow-hidden mb-4">
      <iframe className="absolute top-0 left-0 w-full h-full"
        src={`https://www.youtube.com/embed/${ytMatch[1]}`}
        allowFullScreen/>
    </div>
  )
  if (vimeoMatch) return (
    <div className="relative pb-[56.25%] h-0 rounded-xl overflow-hidden mb-4">
      <iframe className="absolute top-0 left-0 w-full h-full"
        src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
        allowFullScreen/>
    </div>
  )
  return (
    <video controls className="w-full rounded-xl mb-4 max-h-96">
      <source src={url}/> Seu browser não suporta vídeo HTML5.
    </video>
  )
}

// Renderer customizado de Markdown — detecta URLs de vídeo em parágrafos
function DocContent({ content }: { content: string }) {
  const videoUrlRegex = /^https?:\/\/.+\.(mp4|webm|ogg|mov)$|^https?:\/\/(www\.)?(youtube\.com\/watch|youtu\.be\/|vimeo\.com\/\d)/im

  const processedContent = content.split('\n').map((line, i) => {
    const trimmed = line.trim()
    if (videoUrlRegex.test(trimmed)) {
      return `\n[VIDEO:${trimmed}]\n`
    }
    return line
  }).join('\n')

  const parts = processedContent.split(/\[VIDEO:(.+?)\]/)

  return (
    <article className="prose-nexus">
      {parts.map((part, i) => {
        if (i % 2 === 1) return <VideoEmbed key={i} url={part}/>
        return part ? (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>{part}</ReactMarkdown>
        ) : null
      })}
    </article>
  )
}

export default function DocPage() {
  const { id } = useParams()
  const router = useRouter()
  const { firmId } = useFirm()
  const user = getUser()

  const [doc, setDoc] = useState<any>(null)
  const [category, setCategory] = useState<any>(null)
  const [progress, setProgress] = useState<any>(null)
  const [comments, setComments] = useState<any[]>([])
  const [users, setUsers] = useState<Record<string,string>>({})
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<string|null>(null)

  const [signing, setSigning] = useState(false)
  const [signName, setSignName] = useState('')
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [signed, setSigned] = useState(false)
  const [read, setRead] = useState(false)
  const [savingComment, setSavingComment] = useState(false)
  const [showVideoInput, setShowVideoInput] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [copied, setCopied] = useState(false)

  async function loadAll() {
    const [docRes, progRes, commentsRes, usersRes, permRes] = await Promise.all([
      supabase.from('nf_documents').select('*').eq('id', id).single(),
      user ? supabase.from('nf_user_progress').select('*').eq('user_id', user.id).eq('document_id', id).maybeSingle() : null,
      supabase.from('nf_comments').select('*').eq('document_id', id).order('created_at'),
      supabase.from('nf_users').select('id,name').eq('firm_id', firmId),
      user ? supabase.from('nf_document_permissions').select('document_id').eq('user_id', user.id).eq('document_id', id).maybeSingle() : null,
    ])

    if (docRes.data) {
      // Controle de acesso: admin, ou cargo permitido, ou permissão individual.
      const roles = docRes.data.allowed_roles || ['admin','editor','member']
      const allowed = user?.role === 'admin' || roles.includes(user?.role || '') || !!permRes?.data
      if (!allowed) { setDenied(true); setLoading(false); return }

      setDoc(docRes.data)
      if (docRes.data.category_id) {
        const catRes = await supabase.from('nf_categories').select('*').eq('id', docRes.data.category_id).single()
        setCategory(catRes.data)
      }
      supabase.from('nf_documents').update({ view_count: (docRes.data.view_count||0)+1 }).eq('id', id)
    }

    if (progRes?.data) {
      setProgress(progRes.data)
      setSigned(!!progRes.data.signed_at)
      setRead(!!progRes.data.read_at)
    }

    setComments(commentsRes.data || [])
    const uMap: Record<string,string> = {}
    for (const u of (usersRes.data||[])) uMap[u.id] = u.name
    setUsers(uMap)
    setLoading(false)
  }

  // Recarrega ao mudar o documento ou a firma; loadAll depende de id e firmId.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAll() }, [id, firmId])

  async function markAsRead() {
    if (!user || read) return
    const now = new Date().toISOString()
    await supabase.from('nf_user_progress').upsert({
      user_id: user.id, document_id: id, read_at: now,
    }, { onConflict: 'user_id,document_id' })
    setRead(true)
    // Notificar admin se doc requer leitura
    if (doc?.requires_reading) {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() || ''}` },
        body: JSON.stringify({
          type: 'signed', userId: user.id, firmId,
          title: `📖 Leitura confirmada: ${doc.title}`,
          message: `${user.name} confirmou a leitura do documento "${doc.title}".`,
          link: `/app/docs/${id}`, sendEmail: false,
        })
      })
    }
  }

  async function handleSign() {
    if (!signName.trim() || !user) return
    setSigning(true)
    const now = new Date().toISOString()
    await supabase.from('nf_user_progress').upsert({
      user_id: user.id, document_id: id,
      signed_at: now, read_at: now, signature_name: signName,
    }, { onConflict: 'user_id,document_id' })
    setSigned(true); setRead(true)
    // Notificar
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() || ''}` },
      body: JSON.stringify({
        type: 'signed', userId: user.id, firmId,
        title: `✍️ Documento assinado: ${doc?.title}`,
        message: `${user.name} assinou digitalmente o documento "${doc?.title}".`,
        link: `/app/docs/${id}`, sendEmail: false,
      })
    })
    setSigning(false)
  }

  async function addComment() {
    if (!newComment.trim() || !user) return
    setSavingComment(true)
    const { data } = await supabase.from('nf_comments').insert({
      document_id: id, user_id: user.id,
      content: newComment.trim(),
      parent_id: replyTo || null,
    }).select().single()
    if (data) {
      setComments(prev => [...prev, data])
      setNewComment('')
      setReplyTo(null)
    }
    setSavingComment(false)
  }

  async function deleteComment(commentId: string) {
    await supabase.from('nf_comments').delete().eq('id', commentId)
    setComments(prev => prev.filter(c => c.id !== commentId))
  }

  async function insertVideo() {
    if (!videoUrl.trim() || !doc) return
    const newContent = doc.content + `\n\n${videoUrl.trim()}\n`
    await supabase.from('nf_documents').update({ content: newContent }).eq('id', id)
    setDoc((prev: any) => ({ ...prev, content: newContent }))
    setVideoUrl('')
    setShowVideoInput(false)
  }

  function copyLink() {
    const url = `${window.location.origin}/public/${doc?.public_token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function exportPDF() { window.print() }

  // Comentários top-level e respostas
  const topComments = comments.filter(c => !c.parent_id)
  const replies = (parentId: string) => comments.filter(c => c.parent_id === parentId)

  if (loading) return (
    <div className="flex items-center justify-center h-full py-20">
      <Loader2 className="w-6 h-6 animate-spin text-amber-400"/>
    </div>
  )

  if (denied) return (
    <div className="flex flex-col items-center justify-center h-full py-20 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-400/10 border border-red-400/20 flex items-center justify-center mb-4">
        <Lock className="w-6 h-6 text-red-400"/>
      </div>
      <h1 className="text-lg font-bold text-white mb-1">Acesso restrito</h1>
      <p className="text-sm text-slate-400 max-w-sm">Você não tem permissão para ver este documento. Fale com um administrador se precisar de acesso.</p>
      <button onClick={() => router.push('/app/docs')}
        className="mt-5 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-sm transition">
        ← Voltar à base
      </button>
    </div>
  )

  if (!doc) return (
    <div className="p-6 text-center text-slate-400">Documento não encontrado.</div>
  )

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition">
          <ArrowLeft className="w-4 h-4"/>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 flex-wrap">
            {category && <span>{category.icon} {category.name}</span>}
            {doc.tags?.map((t: string) => (
              <span key={t} className="flex items-center gap-1"><Tag className="w-2.5 h-2.5"/>{t}</span>
            ))}
          </div>
          <h1 className="text-xl font-bold text-white">{doc.title}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {user?.role !== 'member' && (
            <button onClick={() => setShowVideoInput(!showVideoInput)}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition" title="Inserir vídeo">
              <Video className="w-4 h-4"/>
            </button>
          )}
          <button onClick={copyLink} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition" title="Copiar link público">
            {copied ? <CheckCircle2 className="w-4 h-4 text-green-400"/> : <Share2 className="w-4 h-4"/>}
          </button>
          <button onClick={exportPDF} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition" title="Exportar PDF">
            <Download className="w-4 h-4"/>
          </button>
          {user?.role !== 'member' && (
            <button onClick={() => router.push(`/app/docs/${id}/edit`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition">
              <History className="w-3.5 h-3.5"/> Editar / Versões
            </button>
          )}
        </div>
      </div>

      {/* Inserir vídeo */}
      {showVideoInput && (
        <div className="bg-slate-900 border border-amber-500/20 rounded-xl p-4 mb-4">
          <p className="text-xs text-amber-400 mb-2 flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5"/> Inserir vídeo no documento
          </p>
          <div className="flex gap-2">
            <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
              placeholder="Cole a URL do YouTube, Vimeo ou MP4..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"/>
            <button onClick={insertVideo} disabled={!videoUrl.trim()}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-onaccent font-semibold rounded-lg text-sm transition">
              Inserir
            </button>
            <button onClick={() => setShowVideoInput(false)} className="px-3 py-2 text-slate-400 hover:text-white transition text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Status badges */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {doc.requires_reading && (
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${read ? 'bg-green-400/10 text-green-400 border-green-400/20' : 'bg-blue-400/10 text-blue-400 border-blue-400/20'}`}>
            <CheckCircle2 className="w-3.5 h-3.5"/>
            {read ? 'Leitura confirmada' : 'Leitura obrigatória'}
          </div>
        )}
        {doc.requires_signature && (
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${signed ? 'bg-green-400/10 text-green-400 border-green-400/20' : 'bg-amber-400/10 text-amber-400 border-amber-400/20'}`}>
            <PenLine className="w-3.5 h-3.5"/>
            {signed ? 'Assinado digitalmente' : 'Requer assinatura'}
          </div>
        )}
        <div className="flex items-center gap-1 text-xs text-slate-500 ml-auto">
          <Eye className="w-3 h-3"/> {doc.view_count} visualizações
          <MessageCircle className="w-3 h-3 ml-2"/> {comments.length} comentários
        </div>
      </div>

      {/* Conteúdo */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 mb-6">
        <DocContent content={doc.content}/>
      </div>

      {/* Ações de confirmação */}
      <div className="space-y-3 mb-8">
        {doc.requires_reading && !read && (
          <button onClick={markAsRead}
            className="w-full flex items-center justify-center gap-2 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-400 font-medium py-3 rounded-xl transition">
            <CheckCircle2 className="w-4 h-4"/> Confirmar leitura completa
          </button>
        )}
        {doc.requires_signature && !signed && (
          <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-5">
            <p className="text-sm font-medium text-amber-400 mb-1 flex items-center gap-2">
              <PenLine className="w-4 h-4"/> Assinatura Digital Obrigatória
            </p>
            <p className="text-xs text-slate-400 mb-4">Digite seu nome completo para confirmar leitura e concordância.</p>
            <div className="flex gap-3">
              <input value={signName} onChange={e => setSignName(e.target.value)}
                placeholder="Seu nome completo"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"/>
              <button onClick={handleSign} disabled={signing || !signName.trim()}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-onaccent font-semibold px-4 py-2 rounded-lg transition">
                {signing ? <Loader2 className="w-4 h-4 animate-spin"/> : <PenLine className="w-4 h-4"/>}
                Assinar
              </button>
            </div>
          </div>
        )}
        {signed && (
          <div className="flex items-center gap-2 text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-3">
            <CheckCircle2 className="w-4 h-4"/> Assinado por <strong>{progress?.signature_name}</strong>
          </div>
        )}
      </div>

      {/* Comentários */}
      <div className="border-t border-slate-800 pt-6">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-slate-400"/>
          Comentários ({comments.length})
        </h3>

        {/* Input novo comentário */}
        <div className="flex gap-3 mb-6">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0">
            {user?.name?.charAt(0) || '?'}
          </div>
          <div className="flex-1">
            {replyTo && (
              <div className="flex items-center gap-2 text-xs text-blue-400 mb-2">
                Respondendo comentário
                <button onClick={() => setReplyTo(null)} className="text-slate-500 hover:text-white">× cancelar</button>
              </div>
            )}
            <div className="flex gap-2">
              <input value={newComment} onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addComment()}
                placeholder={replyTo ? 'Escreva sua resposta...' : 'Escreva um comentário...'}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"/>
              <button onClick={addComment} disabled={savingComment || !newComment.trim()}
                className="p-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-onaccent rounded-lg transition">
                {savingComment ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
              </button>
            </div>
          </div>
        </div>

        {/* Lista de comentários */}
        {topComments.length === 0 ? (
          <div className="text-center py-8 text-slate-600 text-sm">
            Nenhum comentário ainda. Seja o primeiro!
          </div>
        ) : (
          <div className="space-y-4">
            {topComments.map(comment => (
              <div key={comment.id}>
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0">
                    {users[comment.user_id]?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-white">{users[comment.user_id] || 'Usuário'}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-600">{new Date(comment.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
                        <button onClick={() => setReplyTo(comment.id)} className="text-[10px] text-blue-400 hover:underline">Responder</button>
                        {(user?.id === comment.user_id || user?.role === 'admin') && (
                          <button onClick={() => deleteComment(comment.id)} className="text-[10px] text-red-400/50 hover:text-red-400">
                            <Trash2 className="w-3 h-3"/>
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">{comment.content}</p>
                  </div>
                </div>

                {/* Respostas */}
                {replies(comment.id).map(reply => (
                  <div key={reply.id} className="flex gap-3 ml-10 mt-2">
                    <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0">
                      {users[reply.user_id]?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-medium text-white">{users[reply.user_id] || 'Usuário'}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-600">{new Date(reply.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
                          {(user?.id === reply.user_id || user?.role === 'admin') && (
                            <button onClick={() => deleteComment(reply.id)} className="text-[10px] text-red-400/50 hover:text-red-400">
                              <Trash2 className="w-3 h-3"/>
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-300">{reply.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
