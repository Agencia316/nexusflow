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
