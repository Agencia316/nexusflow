'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { useFirm } from '@/lib/firm-context'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  BookOpen, Sparkles, Loader2, CheckCircle2, Search,
  Plus, Pencil, Trash2, X, Save, Eye, EyeOff,
  ArrowRight, FileText, Tag, RefreshCw
} from 'lucide-react'

// Templates padrão do sistema (somente leitura)
const SYSTEM_TEMPLATES = [
  { id:'t1', segment:'advocacia', cat:'Advocacia', icon:'⚖️', title:'Script de Primeiro Contato — WhatsApp', tags:['script','captação','whatsapp'], content:`# Script de Primeiro Contato — WhatsApp\n\n## Mensagem de Abertura (até 5 min após lead entrar)\n\n> "Olá, [Nome]! Aqui é da [Nome do Escritório]. Vi que você tem interesse em saber mais sobre o benefício INSS. Posso te fazer 3 perguntinhas rápidas pra verificar seu direito?"\n\n## Perguntas de Qualificação\n\n1. Você sofreu algum acidente de trabalho ou doença ocupacional?\n2. Ficou com alguma sequela permanente (dor, limitação, perda auditiva)?\n3. Você trabalha ou trabalhou com carteira assinada ou contribui para o INSS?\n\n## Se qualificado (3 SIM)\n> "Ótimo! Você pode ter direito a um benefício mensal vitalício do INSS. Vou te conectar com nossa especialista para explicar tudo. Posso agendar?"\n\n## Objeções Comuns\n\n**"Já faz muito tempo do acidente"**\n> O prazo legal é de 5 anos. Se foi dentro desse período, você ainda tem direito.\n\n**"Já recebi do INSS"**\n> Auxílio-acidente é diferente do auxílio-doença. São benefícios distintos e cumuláveis.\n\n**"Vou pensar"**\n> Claro! A avaliação é gratuita e sem compromisso. Você só paga se ganhar (honorários de êxito).` },
  { id:'t2', segment:'advocacia', cat:'Advocacia', icon:'⚖️', title:'Checklist de Documentação — Benefício INSS', tags:['documentação','checklist','inss'], content:`# Checklist de Documentação — Benefício INSS\n\n## Documentos Universais\n- [ ] RG ou CNH (frente e verso)\n- [ ] CPF\n- [ ] Comprovante de residência (últimos 3 meses)\n- [ ] Extrato CNIS atualizado (app Meu INSS ou tel. 135)\n\n## Para Acidente de Trabalho (B-94)\n- [ ] CAT — Comunicação de Acidente de Trabalho\n- [ ] PPP — Perfil Profissiográfico Previdenciário\n- [ ] Laudo médico com CID e descrição da sequela\n- [ ] CTPS — Carteira de Trabalho\n\n## Para Acidente Não-Laboral (B-36)\n- [ ] Laudo médico com CID e sequela permanente descrita\n- [ ] Exames de imagem com laudo do radiologista\n- [ ] Prontuário hospitalar do atendimento de emergência\n- [ ] Boletim de Ocorrência (se acidente de trânsito)` },
  { id:'t3', segment:'advocacia', cat:'Advocacia', icon:'⚖️', title:'Política de Honorários — Advocacia de Êxito', tags:['honorários','política'], content:`# Política de Honorários\n\n## Modelo de Cobrança\nO escritório trabalha exclusivamente com **honorários de êxito**: o cliente não paga nada antecipado.\n\n## Percentual\n- **30%** sobre o valor total recebido (retroativo + parcelas futuras por 12 meses)\n- Inclui todos os custos processuais\n\n## O que está incluído\n- Análise de viabilidade do caso\n- Instrução documental completa\n- Protocolo administrativo ou ajuizamento\n- Acompanhamento até o recebimento` },
  { id:'t4', segment:'advocacia', cat:'Advocacia', icon:'⚖️', title:'Roteiro de Qualificação Jurídica — J1 a J5', tags:['qualificação','script','jurídico'], content:`# Roteiro de Qualificação Jurídica\n\n## Critério J1 — Qualidade de Segurado\n**Pergunta:** "Você tem ou teve carteira assinada? Ou paga INSS como autônomo, MEI ou rural?"\n\n## Critério J2 — Acidente ou Doença Ocupacional\n**Pergunta:** "Você sofreu algum acidente de trabalho, de trânsito, queda ou doença relacionada ao trabalho?"\n\n## Critério J3 — Sequela Permanente\n**Pergunta:** "Ficou com alguma sequela? Dor constante, limitação de movimento, perda auditiva, visão, sensibilidade?"\n\n## Critério J4 — Não Aposentado por Invalidez\n**Pergunta:** "Você está aposentado por invalidez pelo mesmo acidente?"\n\n## Critério J5 — Prazo de Prescrição\n**Pergunta:** "Quando aconteceu o acidente? Tem a data?"\n- Menos de 5 anos → Qualificado\n- Mais de 5 anos → Caso prescrito` },
  { id:'t9', segment:'solar', cat:'Energia Solar', icon:'☀️', title:'Script de Visita Técnica — Energia Solar', tags:['script','solar','visita'], content:`# Script de Visita Técnica — Energia Solar\n\n## Antes da Visita\n- [ ] Verificar consumo médio dos últimos 12 meses\n- [ ] Calcular estimativa de sistema necessário\n- [ ] Preparar proposta preliminar\n\n## Avaliação do Telhado\n1. Orientação (Norte = ideal no Brasil)\n2. Inclinação (ideal: 15° a 25°)\n3. Sombreamento\n4. Tipo de telha e estrutura\n\n## Apresentação da Proposta\n- Produção estimada em kWh/mês\n- Economia mensal em R$\n- Payback (retorno em meses)` },
  { id:'t10', segment:'solar', cat:'Energia Solar', icon:'☀️', title:'Checklist de Visita Técnica — Solar', tags:['solar','checklist','técnico'], content:`# Checklist de Visita Técnica\n\n## Telhado\n- [ ] Orientação (Norte ideal)\n- [ ] Inclinação (15° a 25°)\n- [ ] Sombreamento\n- [ ] Tipo de telha e área disponível\n\n## Elétrica\n- [ ] Localização do quadro\n- [ ] Padrão de entrada (mono/bi/trifásico)\n\n## Documentos do cliente\n- [ ] Conta de luz (12 meses)\n- [ ] CPF e dados do titular` },
  { id:'t11', segment:'solar', cat:'Energia Solar', icon:'☀️', title:'Processo de Instalação — Passo a Passo', tags:['instalação','solar','processo'], content:`# Processo de Instalação\n\n| Etapa | Prazo |\n|---|---|\n| Projeto elétrico + ART | 5 dias após contrato |\n| Protocolo na concessionária | 7 dias após projeto |\n| Aprovação | 15–45 dias |\n| Instalação | 1–3 dias |\n| Energização | No dia da vistoria |` },
  { id:'t12', segment:'solar', cat:'Energia Solar', icon:'☀️', title:'Política de Garantia — Energia Solar', tags:['garantia','solar','pós-venda'], content:`# Política de Garantia\n\n| Item | Garantia Produto | Garantia Desempenho |\n|---|---|---|\n| Painéis | 10–12 anos | 25–30 anos |\n| Inversor | 5–10 anos | — |\n| Estrutura | 10 anos | — |\n| Mão de obra | 1 ano | — |` },
  { id:'t5', segment:'all', cat:'RH e Onboarding', icon:'🎓', title:'Onboarding Geral — Novo Colaborador', tags:['onboarding','rh'], content:`# Onboarding — Bem-vindo(a) à Equipe!\n\n## Sua Primeira Semana\n\n### Dia 1\n- [ ] Apresentação para a equipe\n- [ ] Configuração de e-mail e sistemas\n- [ ] Leitura do Código de Conduta\n\n### Dias 2–3\n- [ ] Treinamento nas ferramentas\n- [ ] Leitura dos processos do cargo` },
  { id:'t6', segment:'all', cat:'RH e Onboarding', icon:'🎓', title:'Política de Conduta e Ética', tags:['conduta','ética','política'], content:`# Política de Conduta e Ética\n\n## Valores Inegociáveis\n1. **Honestidade** — Nunca prometer resultados que não podemos garantir\n2. **Confidencialidade** — Dados de clientes são sigilosos\n3. **Respeito** — Tratamento digno a clientes, colegas e parceiros\n\n## Aceite\nAo assinar este documento, o colaborador declara ter lido, compreendido e concordado com as regras acima.` },
  { id:'t7', segment:'all', cat:'Processos Operacionais', icon:'⚙️', title:'Fluxo de Atendimento ao Cliente', tags:['fluxo','atendimento'], content:`# Fluxo de Atendimento ao Cliente\n\n| Etapa | Responsável | Prazo |\n|---|---|---|\n| Primeiro contato | SDR de Captação | Até 5 min |\n| Qualificação | SDR de Qualificação | Até 2h |\n| Coleta de documentos | Closer | Até 5 dias úteis |` },
  { id:'t8', segment:'all', cat:'Processos Operacionais', icon:'⚙️', title:'Rotina de Reunião Semanal', tags:['reunião','rotina','gestão'], content:`# Reunião Semanal de Equipe\n\n- **Quando:** Segunda-feira, 09h00\n- **Duração:** 45 minutos\n\n## Pauta\n1. Números da semana (10 min)\n2. Gargalos (15 min)\n3. Prioridades (10 min)\n4. Ações e responsáveis (5 min)` },
]

interface Template {
  id: string; title: string; content: string; tags: string[]
  cat?: string; icon?: string; segment?: string
  is_custom?: boolean; firm_id?: string
}

export default function TemplatesPage() {
  const router = useRouter()
  const { firmId, firmSegment } = useFirm()
  const user = getUser()
  const canEdit = user?.role === 'admin' || user?.role === 'editor'

  const [search,    setSearch]    = useState('')
  const [custom,    setCustom]    = useState<Template[]>([])
  const [loading,   setLoading]   = useState(true)
  const [using,     setUsing]     = useState<string|null>(null)
  const [done,      setDone]      = useState<string|null>(null)

  // Modal de edição/criação
  const [modal,     setModal]     = useState(false)
  const [editing,   setEditing]   = useState<Template|null>(null)
  const [preview,   setPreview]   = useState(false)
  const [form,      setForm]      = useState({ title:'', content:'', tags:'', cat:'', icon:'📄' })
  const [saving,    setSaving]    = useState(false)
  const [aiPrompt,  setAiPrompt]  = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [deleteId,  setDeleteId]  = useState<string|null>(null)

  useEffect(() => { loadCustom() }, [firmId])

  async function loadCustom() {
    const { data } = await supabase.from('nf_documents')
      .select('id,title,content,tags,status')
      .eq('firm_id', firmId)
      .eq('status', 'template')
      .order('created_at', { ascending: false })
    setCustom((data||[]).map(d => ({
      id: d.id, title: d.title, content: d.content||'',
      tags: d.tags||[], is_custom: true, firm_id: firmId,
      cat: 'Modelos da Empresa', icon: '⭐',
    })))
    setLoading(false)
  }

  // Templates visíveis: sistema filtrado por segmento + customizados da empresa
  const systemVisible = SYSTEM_TEMPLATES.filter(t => {
    const seg = t.segment === 'all' || t.segment === firmSegment
    const q = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.tags.some(g => g.includes(search.toLowerCase()))
    return seg && q
  })
  const customVisible = custom.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase())
  )

  const allTemplates = [...customVisible, ...systemVisible]
  const cats = ['Modelos da Empresa', ...Array.from(new Set(systemVisible.map(t => t.cat!)))]
    .filter(c => c === 'Modelos da Empresa' ? customVisible.length > 0 : systemVisible.some(t => t.cat === c))

  // Usar template — cria documento rascunho e abre para edição
  async function useTemplate(t: Template) {
    if (!canEdit) return
    setUsing(t.id)
    const { data: cats } = await supabase.from('nf_categories').select('id').eq('firm_id', firmId).limit(1)
    const { data: doc } = await supabase.from('nf_documents').insert({
      firm_id: firmId,
      category_id: cats?.[0]?.id || null,
      title: t.title,
      content: t.content,
      status: 'draft',
      tags: t.tags,
      allowed_roles: ['admin','editor','member'],
    }).select('id').single()
    setUsing(null)
    setDone(t.id)
    setTimeout(() => { setDone(null); if (doc?.id) router.push(`/app/docs/${doc.id}/edit`) }, 800)
  }

  // Abrir modal novo
  function openNew() {
    setEditing(null)
    setForm({ title:'', content:'', tags:'', cat:'Modelos da Empresa', icon:'📄' })
    setAiPrompt(''); setPreview(false)
    setModal(true)
  }

  // Abrir modal edição
  function openEdit(t: Template) {
    setEditing(t)
    setForm({ title:t.title, content:t.content, tags:(t.tags||[]).join(', '), cat:t.cat||'', icon:t.icon||'📄' })
    setAiPrompt(''); setPreview(false)
    setModal(true)
  }

  // Gerar conteúdo com IA
  async function generateAI() {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/generate-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, firmId, segment: firmSegment }),
      })
      const data = await res.json()
      setForm(f => ({ ...f, title: data.title || f.title, content: data.content || f.content }))
      setAiPrompt('')
    } catch { alert('Erro ao gerar. Tente novamente.') }
    finally { setAiLoading(false) }
  }

  // Salvar modelo
  async function saveTemplate() {
    if (!form.title.trim()) { alert('Informe o título.'); return }
    if (!form.content.trim()) { alert('Informe o conteúdo.'); return }
    setSaving(true)
    const tags = form.tags.split(',').map(t=>t.trim()).filter(Boolean)
    try {
      if (editing?.is_custom) {
        await supabase.from('nf_documents').update({
          title: form.title, content: form.content, tags,
        }).eq('id', editing.id)
      } else {
        await supabase.from('nf_documents').insert({
          firm_id: firmId, title: form.title, content: form.content,
          tags, status: 'template',
          allowed_roles: ['admin','editor','member'],
        })
      }
      await loadCustom()
      setModal(false)
    } catch(e:any) { alert('Erro: ' + e.message) }
    finally { setSaving(false) }
  }

  // Deletar modelo customizado
  async function deleteTemplate(id: string) {
    await supabase.from('nf_documents').delete().eq('id', id)
    await loadCustom()
    setDeleteId(null)
  }

  const ICONS = ['📄','⚖️','☀️','🎓','⚙️','📋','💬','📊','🔧','📐','💰','✅','📌','🗂️']

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Modelos de Documentos</h1>
          <p className="text-slate-400 text-sm mt-1">
            Templates do sistema + modelos da sua empresa · Clique em <strong className="text-amber-400">Usar modelo</strong> para criar um rascunho editável
          </p>
        </div>
        {canEdit && (
          <button onClick={openNew}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-onaccent font-semibold px-4 py-2 rounded-xl text-sm transition">
            <Plus className="w-4 h-4"/> Novo modelo
          </button>
        )}
      </div>

      {/* Busca */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar modelos por título ou tag..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"/>
      </div>

      {/* Confirmação de exclusão */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-white mb-2">Excluir modelo?</h3>
            <p className="text-sm text-slate-400 mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={()=>setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition">Cancelar</button>
              <button onClick={()=>deleteTemplate(deleteId)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-semibold transition">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Lista por categoria */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-20 bg-slate-900 rounded-xl animate-pulse"/>)}</div>
      ) : (
        cats.map(cat => {
          const items = cat === 'Modelos da Empresa'
            ? customVisible
            : systemVisible.filter(t => t.cat === cat)
          if (!items.length) return null
          return (
            <div key={cat} className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{cat}</h2>
                {cat === 'Modelos da Empresa' && (
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">personalizados</span>
                )}
              </div>
              <div className="space-y-2">
                {items.map(t => (
                  <div key={t.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex items-start gap-4 group transition">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-lg shrink-0">{t.icon||'📄'}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-white mb-1">{t.title}</h3>
                      {t.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {t.tags.map(tag => (
                            <span key={tag} className="text-[10px] bg-slate-800 border border-slate-700 text-slate-500 px-2 py-0.5 rounded-full">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition">
                      {t.is_custom && canEdit && (
                        <>
                          <button onClick={()=>openEdit(t)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-xs transition">
                            <Pencil className="w-3 h-3"/> Editar
                          </button>
                          <button onClick={()=>setDeleteId(t.id)}
                            className="p-1.5 rounded-lg border border-slate-800 text-slate-600 hover:text-red-400 hover:border-red-400/30 transition">
                            <Trash2 className="w-3 h-3"/>
                          </button>
                        </>
                      )}
                      {canEdit && (
                        <button onClick={()=>useTemplate(t)} disabled={!!using}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            done===t.id ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20'}`}>
                          {using===t.id ? <Loader2 className="w-3 h-3 animate-spin"/> :
                           done===t.id ? <><CheckCircle2 className="w-3 h-3"/> Criado!</> :
                           <><ArrowRight className="w-3 h-3"/> Usar modelo</>}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}

      {allTemplates.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20"/>
          <p className="text-sm">Nenhum modelo encontrado.</p>
        </div>
      )}

      {/* ── MODAL CRIAR/EDITAR ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-end">
          <div className="w-full max-w-2xl h-full bg-slate-950 border-l border-slate-800 flex flex-col overflow-hidden">
            {/* Header modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
              <div>
                <h2 className="font-semibold text-white">{editing ? 'Editar modelo' : 'Novo modelo'}</h2>
                <p className="text-xs text-slate-500 mt-0.5">Modelos ficam disponíveis para toda a equipe reutilizar</p>
              </div>
              <button onClick={()=>setModal(false)} className="text-slate-400 hover:text-white transition">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Ícone + Título */}
              <div className="flex gap-3">
                <div className="shrink-0">
                  <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Ícone</label>
                  <select value={form.icon} onChange={e=>setForm(f=>({...f,icon:e.target.value}))}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-lg text-white focus:outline-none focus:border-amber-500 transition w-16">
                    {ICONS.map(ic=><option key={ic} value={ic}>{ic}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Título *</label>
                  <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                    placeholder="Ex: Script de Captação — WhatsApp"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"/>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Tags (separadas por vírgula)</label>
                <input value={form.tags} onChange={e=>setForm(f=>({...f,tags:e.target.value}))}
                  placeholder="script, captação, whatsapp"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"/>
              </div>

              {/* Gerar com IA */}
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
                <p className="text-xs font-semibold text-purple-400 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5"/> Gerar conteúdo com IA
                </p>
                <div className="flex gap-2">
                  <input value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&generateAI()}
                    placeholder="Descreva o modelo... Ex: Script de follow-up para leads frios"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 transition"/>
                  <button onClick={generateAI} disabled={aiLoading || !aiPrompt.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 disabled:opacity-40 text-white text-sm font-medium transition">
                    {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Sparkles className="w-3.5 h-3.5"/>}
                    {aiLoading ? 'Gerando...' : 'Gerar'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-600 mt-1.5">A IA preenche título e conteúdo — você edita antes de salvar</p>
              </div>

              {/* Editor / Preview toggle */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-medium text-slate-500">Conteúdo (Markdown) *</label>
                  <button onClick={()=>setPreview(p=>!p)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition">
                    {preview ? <><EyeOff className="w-3.5 h-3.5"/> Editar</> : <><Eye className="w-3.5 h-3.5"/> Pré-visualizar</>}
                  </button>
                </div>
                {preview ? (
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 min-h-64 max-h-96 overflow-y-auto">
                    <article className="prose-nexus">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{form.content || '*Nenhum conteúdo ainda*'}</ReactMarkdown>
                    </article>
                  </div>
                ) : (
                  <textarea value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))}
                    placeholder="# Título do modelo&#10;&#10;## Seção 1&#10;Conteúdo aqui...&#10;&#10;## Seção 2&#10;- Item 1&#10;- Item 2"
                    rows={16}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition resize-none font-mono leading-relaxed"/>
                )}
              </div>
            </div>

            {/* Footer modal */}
            <div className="px-6 py-4 border-t border-slate-800 flex gap-3 shrink-0">
              <button onClick={()=>setModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition">
                Cancelar
              </button>
              <button onClick={saveTemplate} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-onaccent font-semibold py-2.5 rounded-xl text-sm transition">
                {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                {editing ? 'Salvar alterações' : 'Criar modelo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
