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
 * Cada firma usa a PRÓPRIA chave. Não há mais fallback para uma chave global
 * (`OPENAI_API_KEY`): ela fazia a plataforma pagar a IA de qualquer firma, e
 * como o fallback valia mesmo com `ai_enabled = false`, o toggle de
 * Configurações → IA não tinha efeito nenhum.
 *
 * Sem chave da firma, ou com a IA desligada, `apiKey` é `null` — o contrato de
 * "IA indisponível", que o chamador traduz em 503.
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

  return { apiKey: settings.openai_api_key || null, model }
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
