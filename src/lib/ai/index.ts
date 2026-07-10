import { callAnthropic, verifyAnthropicKey } from './anthropic'
import { callOpenAI, verifyOpenAIKey } from './openai'
import type { AiProvider, AiRequest, AiResult } from './providers'

export * from './providers'

/**
 * Ponto único de chamada de IA do NexusFlow. Nenhuma rota deve falar direto
 * com a OpenAI ou a Anthropic — passe por aqui, e o provedor da firma decide.
 *
 * Sobre `temperature`: só a OpenAI aceita. Ver o comentário em `anthropic.ts`.
 */
export function callAi(provider: AiProvider, req: AiRequest): Promise<AiResult> {
  return provider === 'anthropic' ? callAnthropic(req) : callOpenAI(req)
}

export function verifyKey(provider: AiProvider, apiKey: string): Promise<boolean> {
  return provider === 'anthropic' ? verifyAnthropicKey(apiKey) : verifyOpenAIKey(apiKey)
}

/**
 * Traduz uma falha de IA em resposta HTTP, sem vazar o erro cru do provedor —
 * o 401 da OpenAI traz a chave mascarada no corpo.
 */
export function aiErrorResponse(error: { reason: 'auth' | 'transient' }): {
  status: number
  body: { error: string }
} {
  return error.reason === 'auth'
    ? {
        status: 502,
        body: { error: 'IA indisponível: a chave desta firma é inválida. Verifique em Configurações → IA.' },
      }
    : { status: 502, body: { error: 'IA indisponível no momento. Tente novamente em instantes.' } }
}

/** Mensagem única para "firma sem IA": ou o toggle está off, ou falta a chave. */
export const AI_NOT_CONFIGURED =
  'IA não configurada. Ative a IA e cadastre a chave do seu provedor em Configurações → IA.'
