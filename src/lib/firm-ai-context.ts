import { supabaseAdmin } from '@/lib/supabase-admin'

export type FirmAiContext = {
  /** Nome da firma + descrição do segmento, para o system prompt. */
  firmContext: string
  /** Descrição longa do segmento, usada como especialidade do assistente. */
  segmentContext: string
}

const SEGMENT_CONTEXT: Record<string, string> = {
  solar: 'empresa de energia solar fotovoltaica — vendas, instalação, projetos, financiamento, pós-venda',
  advocacia: 'escritório de advocacia previdenciária — Auxílio-Acidente INSS, B-36, B-94, critérios J1-J5, SDR, Closer',
}

const FALLBACK_SEGMENT_CONTEXT = 'empresa — documentação operacional, processos internos e atendimento'

export function segmentContextFor(segment?: string | null): string {
  return (segment && SEGMENT_CONTEXT[segment]) || FALLBACK_SEGMENT_CONTEXT
}

/**
 * Monta o contexto de IA de uma firma a partir do banco.
 *
 * O contexto nunca vem do cliente: `firmId` é o único dado confiável que ele
 * envia, e nome/segmento são lidos de `nf_firms` com a service role key.
 */
export type FirmOpenAI = {
  apiKey: string | null
  model: string
}

/**
 * Resolve a chave/modelo da OpenAI de uma firma.
 *
 * Duas regras, nesta ordem:
 *
 * 1. `ai_enabled = false` desliga a IA da firma. Sem isso, o fallback para a
 *    chave global fazia uma firma com a IA desligada consumir a chave da
 *    plataforma — o toggle de Configurações → IA não tinha efeito nenhum e o
 *    503 "IA não configurada" nunca disparava enquanto existisse global.
 * 2. Com a IA ligada, a chave da firma tem precedência sobre a global
 *    (OPENAI_API_KEY), que é só um fallback. Rotas que usam apenas a global
 *    quebram para todas as firmas quando ela não está configurada — foi o
 *    caso do import-doc.
 *
 * `apiKey: null` é o contrato de "IA indisponível": o chamador responde 503.
 */
export async function getFirmOpenAI(firmId?: string | null): Promise<FirmOpenAI> {
  const { data: settings } = firmId
    ? await supabaseAdmin
        .from('nf_firm_settings')
        .select('openai_api_key, ai_model, ai_enabled')
        .eq('firm_id', firmId)
        .maybeSingle()
    : { data: null }

  const model = settings?.ai_model || 'gpt-4o'
  if (!settings?.ai_enabled) return { apiKey: null, model }

  return {
    apiKey: settings.openai_api_key || process.env.OPENAI_API_KEY || null,
    model,
  }
}

export async function getFirmAiContext(firmId?: string | null): Promise<FirmAiContext> {
  if (!firmId) {
    return { firmContext: '', segmentContext: FALLBACK_SEGMENT_CONTEXT }
  }

  const { data: firm } = await supabaseAdmin
    .from('nf_firms')
    .select('name, segment')
    .eq('id', firmId)
    .maybeSingle()

  if (!firm) {
    return { firmContext: '', segmentContext: FALLBACK_SEGMENT_CONTEXT }
  }

  const segmentContext = segmentContextFor(firm.segment)
  return {
    firmContext: `${firm.name} — ${segmentContext}`,
    segmentContext,
  }
}
