import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAiProvider, resolveModel, type AiProvider } from '@/lib/ai'

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
export type FirmAI = {
  provider: AiProvider
  apiKey: string | null
  model: string
}

/**
 * Resolve provedor, chave e modelo de IA de uma firma.
 *
 * Cada firma escolhe o provedor (OpenAI ou Anthropic) e usa a PRÓPRIA chave.
 * Não há fallback para uma chave global: ela fazia a plataforma pagar a IA de
 * qualquer firma, e como o fallback valia mesmo com `ai_enabled = false`, o
 * toggle de Configurações → IA não tinha efeito nenhum.
 *
 * Sem chave da firma, ou com a IA desligada, `apiKey` é `null` — o contrato de
 * "IA indisponível", que o chamador traduz em 503.
 *
 * `resolveModel` protege contra um modelo órfão: se a firma trocou de provedor
 * e a coluna `ai_model` ainda guarda o modelo do provedor antigo, cai no
 * default do novo em vez de mandar `gpt-4o` para a Anthropic.
 */
export async function getFirmAI(firmId?: string | null): Promise<FirmAI> {
  const { data: settings } = firmId
    ? await supabaseAdmin
        .from('nf_firm_settings')
        .select('openai_api_key, ai_model, ai_enabled, ai_provider')
        .eq('firm_id', firmId)
        .maybeSingle()
    : { data: null }

  const provider: AiProvider = isAiProvider(settings?.ai_provider) ? settings.ai_provider : 'openai'
  const model = resolveModel(provider, settings?.ai_model)

  if (!settings?.ai_enabled) return { provider, apiKey: null, model }

  return { provider, apiKey: settings.openai_api_key || null, model }
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
