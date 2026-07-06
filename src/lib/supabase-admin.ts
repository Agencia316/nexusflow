import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase SOMENTE PARA O SERVIDOR (rotas /api/*).
 * Usa a SERVICE ROLE KEY, que ignora RLS e as restrições de coluna —
 * necessário para ler segredos como a chave da OpenAI de cada firma,
 * que NÃO é mais legível pelo cliente/anon.
 *
 * ⚠️ NUNCA importe este módulo em componentes 'use client'. A service
 * role key jamais deve chegar ao navegador.
 *
 * Sem SUPABASE_SERVICE_ROLE_KEY no ambiente, cai para a anon key — nesse
 * caso a leitura da chave de IA falha silenciosamente (a rota degrada
 * para "IA não configurada"), mas nada secreto vaza.
 */
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const hasServiceRole = !!serviceKey

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)
