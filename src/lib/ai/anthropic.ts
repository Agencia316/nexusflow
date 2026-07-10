import Anthropic from '@anthropic-ai/sdk'
import type { AiRequest, AiResult } from './providers'

/**
 * Adaptador Anthropic — via SDK oficial (@anthropic-ai/sdk).
 *
 * Duas armadilhas específicas destes modelos:
 *
 * 1. `temperature` / `top_p` / `top_k` foram REMOVIDOS no Opus 4.8 e no
 *    Sonnet 5: enviá-los devolve HTTP 400. Por isso `req.temperature` é
 *    ignorado aqui, e não repassado. Para variar o estilo, use o prompt.
 * 2. O prompt de sistema vai no campo `system` de topo, não como uma
 *    mensagem `{role: 'system'}` dentro de `messages` (isso é a OpenAI).
 *
 * `thinking` fica desligado (campo omitido): as chamadas do NexusFlow são
 * curtas e a latência importa mais que o ganho de raciocínio.
 */
export async function callAnthropic(req: AiRequest): Promise<AiResult> {
  const client = new Anthropic({ apiKey: req.apiKey })

  try {
    const message = await client.messages.create({
      model: req.model,
      max_tokens: req.maxTokens,
      ...(req.system ? { system: req.system } : {}),
      messages: req.messages,
    })

    // `content` é uma união discriminada; só os blocos de texto interessam.
    const text = message.content
      .flatMap(block => (block.type === 'text' ? [block.text] : []))
      .join('')

    if (!text.trim()) {
      return {
        kind: 'error',
        error: {
          reason: 'transient',
          status: 502,
          detail: `resposta sem texto (stop_reason=${message.stop_reason})`,
        },
      }
    }

    return { kind: 'ok', text }
  } catch (e: unknown) {
    // Chave errada, revogada ou sem acesso ao modelo: o usuário é quem resolve.
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      return { kind: 'error', error: { reason: 'auth', status: e.status ?? 401, detail: e.message } }
    }
    if (e instanceof Anthropic.APIError) {
      return { kind: 'error', error: { reason: 'transient', status: e.status ?? 502, detail: e.message } }
    }
    return {
      kind: 'error',
      error: { reason: 'transient', status: 502, detail: e instanceof Error ? e.message : String(e) },
    }
  }
}

/** Valida a chave sem gastar tokens: lista os modelos visíveis a ela. */
export async function verifyAnthropicKey(apiKey: string): Promise<boolean> {
  try {
    await new Anthropic({ apiKey }).models.list()
    return true
  } catch {
    return false
  }
}
