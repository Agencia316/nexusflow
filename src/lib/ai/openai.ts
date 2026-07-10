import type { AiRequest, AiResult } from './providers'

/**
 * Adaptador OpenAI — HTTP direto, como sempre foi neste projeto (não há SDK
 * da OpenAI nas dependências, e as chamadas são simples demais para justificar
 * uma).
 *
 * Aqui o prompt de sistema é a primeira mensagem de `messages` com
 * `role: 'system'` — diferente da Anthropic, que tem campo próprio.
 */
const ENDPOINT = 'https://api.openai.com/v1/chat/completions'

export async function callOpenAI(req: AiRequest): Promise<AiResult> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${req.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: req.model,
        max_tokens: req.maxTokens,
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        messages: [
          ...(req.system ? [{ role: 'system', content: req.system }] : []),
          ...req.messages,
        ],
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const detail = body?.error?.message || `HTTP ${res.status}`
      const reason = res.status === 401 || res.status === 403 ? 'auth' : 'transient'
      return { kind: 'error', error: { reason, status: res.status, detail } }
    }

    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content

    // Sem `choices` a chamada falhou. O `|| '{}'` que existia nas rotas fazia
    // JSON.parse ter SUCESSO, e a rota respondia 200 com corpo vazio.
    if (typeof text !== 'string' || !text.trim()) {
      return {
        kind: 'error',
        error: { reason: 'transient', status: 502, detail: 'resposta sem choices[0].message.content' },
      }
    }

    return { kind: 'ok', text }
  } catch (e: unknown) {
    return {
      kind: 'error',
      error: { reason: 'transient', status: 502, detail: e instanceof Error ? e.message : String(e) },
    }
  }
}

/** Valida a chave sem gastar tokens. */
export async function verifyOpenAIKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    return res.ok
  } catch {
    return false
  }
}
