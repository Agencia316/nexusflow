/**
 * Contrato comum aos provedores de IA suportados (OpenAI e Anthropic).
 *
 * Cada firma escolhe o seu em Configurações → IA e cadastra a própria chave.
 * Não há chave global: sem chave, ou com a IA desligada, as rotas respondem 503.
 */

export const AI_PROVIDERS = ['openai', 'anthropic'] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

export function isAiProvider(v: unknown): v is AiProvider {
  return typeof v === 'string' && (AI_PROVIDERS as readonly string[]).includes(v)
}

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI (ChatGPT)',
}

/** Prefixo da chave de API, usado só para orientar o usuário na tela. */
export const KEY_HINT: Record<AiProvider, string> = {
  anthropic: 'sk-ant-...',
  openai: 'sk-...',
}

export const CONSOLE_URL: Record<AiProvider, string> = {
  anthropic: 'https://console.anthropic.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
}

export type AiModel = { id: string; label: string; desc: string; badge?: string }

export const MODELS: Record<AiProvider, AiModel[]> = {
  anthropic: [
    { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', desc: 'O mais capaz — recomendado', badge: 'Recomendado' },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', desc: 'Equilíbrio entre custo e qualidade' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', desc: 'Mais rápido e econômico', badge: 'Econômico' },
  ],
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o', desc: 'Mais inteligente — recomendado', badge: 'Recomendado' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini', desc: 'Mais rápido e econômico', badge: 'Econômico' },
  ],
}

export const DEFAULT_MODEL: Record<AiProvider, string> = {
  anthropic: 'claude-opus-4-8',
  openai: 'gpt-4o',
}

/** Um modelo do outro provedor não pode sobreviver a uma troca de provedor. */
export function modelBelongsTo(provider: AiProvider, model: string): boolean {
  return MODELS[provider].some(m => m.id === model)
}

export function resolveModel(provider: AiProvider, model?: string | null): string {
  return model && modelBelongsTo(provider, model) ? model : DEFAULT_MODEL[provider]
}

export type AiMessage = { role: 'user' | 'assistant'; content: string }

export type AiRequest = {
  apiKey: string
  model: string
  /** Prompt de sistema. Nos dois provedores vai num campo próprio, não em `messages`. */
  system?: string
  messages: AiMessage[]
  maxTokens: number
  /**
   * Só a OpenAI aceita. Os modelos atuais da Anthropic (Opus 4.8, Sonnet 5)
   * REJEITAM `temperature` com HTTP 400 — o adaptador anthropic ignora este
   * campo de propósito. Não o transforme em obrigatório.
   */
  temperature?: number
}

export type AiFailure = {
  /** `auth` = chave inválida/sem permissão (o usuário resolve). `transient` = resto. */
  reason: 'auth' | 'transient'
  /** Status HTTP do provedor, para log. Nunca repassado cru ao cliente. */
  status: number
  /** Detalhe para o log do servidor. Pode conter a chave mascarada — não exibir. */
  detail: string
}

/**
 * Discriminante é a string `kind`, não um booleano `ok`: este projeto compila
 * com `strict: false`, e sem `strictNullChecks` o TypeScript não estreita união
 * discriminada por booleano (`if (!r.ok)` deixa `r` como a união inteira).
 * Com discriminante string o estreitamento funciona nos dois modos.
 */
export type AiResult =
  | { kind: 'ok'; text: string }
  | { kind: 'error'; error: AiFailure }
