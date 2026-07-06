-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 2 — ISOLAMENTO POR TENANT NO BANCO (RLS real)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ NÃO APLICAR EM PRODUÇÃO DIRETO. Rodar primeiro num BRANCH DE STAGING do
--    Supabase, validar o app inteiro e a prova de isolamento, e só então merge.
--
-- O que esta migration faz:
--   • Cria helpers que leem os claims do JWT de sessão (firm_id, is_super_admin).
--   • Remove as policies permissivas (anon using(true)) e cria policies de
--     `authenticated` escopadas por firma, com bypass para super-admin.
--
-- MUDANÇAS DE CÓDIGO QUE PRECISAM IR JUNTO (fora deste arquivo, na Fase 2):
--   1. src/lib/supabase.ts: o cliente do navegador passa a anexar o token
--      (Authorization: Bearer nf_token) e a recriá-lo em login/logout/troca de firma.
--   2. Rotas server que hoje usam a ANON key e tocam tabelas de tenant precisam
--      passar a usar o supabase-admin (service role, que ignora RLS):
--        /api/search, /api/notify, /api/setup-firm, /api/register
--      (chat, test-ai, generate-doc, generate-quiz JÁ usam admin).
--   3. /cadastro cria firma via /api/setup-firm (service role) — não como anon.
--   4. Fluxo de "sessão expirada": se auth.jwt() estiver ausente/expirado, o
--      app deve forçar novo login (o token tem exp de 8h).
--
-- Observação sobre super-admin: como as policies têm bypass `auth_is_super()`,
-- a impersonation JÁ funciona para leitura/escrita na Fase 2 (o token do super
-- tem is_super_admin=true). O re-mint de token com firm_id alvo + auditoria é a
-- Fase 3 (escopo mais estrito + trilha de auditoria).
-- ───────────────────────────────────────────────────────────────────────────

-- ── Helpers (leem os claims do JWT via auth.jwt()) ─────────────────────────
create or replace function public.auth_firm_id()
returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'firm_id', '')::uuid
$$;

create or replace function public.auth_is_super()
returns boolean language sql stable as $$
  select coalesce((auth.jwt() ->> 'is_super_admin')::boolean, false)
$$;

-- ── Limpa TODAS as policies existentes das tabelas alvo ────────────────────
do $$
declare
  r record;
  alvo text[] := array[
    'nf_alerts','nf_assignments','nf_categories','nf_chat_messages',
    'nf_chat_sessions','nf_documents','nf_embeddings','nf_firm_settings',
    'nf_roles','nf_training_paths','nf_user_progress','nf_users',
    'nf_comments','nf_document_permissions','nf_document_versions',
    'nf_training_steps','nf_certificates','nf_firms'
  ];
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname='public' and tablename = any(alvo)
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ── Garante privilégios do papel `authenticated` nas tabelas de tenant ─────
-- (nf_firm_settings tem SELECT por coluna — já configurado na 0003 — então aqui
--  só concedemos escrita; a coluna openai_api_key continua inacessível.)
do $$
declare
  t text;
  com_firm text[] := array[
    'nf_alerts','nf_assignments','nf_categories','nf_chat_messages',
    'nf_chat_sessions','nf_documents','nf_embeddings','nf_roles',
    'nf_training_paths','nf_user_progress','nf_users',
    'nf_comments','nf_document_permissions','nf_document_versions',
    'nf_training_steps','nf_certificates'
  ];
begin
  foreach t in array com_firm loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
  execute 'grant insert, update, delete on public.nf_firm_settings to authenticated';
  execute 'grant select, insert, update, delete on public.nf_firms to authenticated';
end $$;

-- ── Policies: tabelas COM firm_id (escopo direto) ──────────────────────────
do $$
declare
  t text;
  diretas text[] := array[
    'nf_alerts','nf_assignments','nf_categories','nf_chat_messages',
    'nf_chat_sessions','nf_documents','nf_embeddings','nf_firm_settings',
    'nf_roles','nf_training_paths','nf_user_progress','nf_users'
  ];
begin
  foreach t in array diretas loop
    execute format($f$
      create policy tenant_rw on public.%1$I
        for all to authenticated
        using ( %1$I.firm_id = public.auth_firm_id() or public.auth_is_super() )
        with check ( %1$I.firm_id = public.auth_firm_id() or public.auth_is_super() )
    $f$, t);
  end loop;
end $$;

-- ── Policies: tabelas SEM firm_id (derivam por join) ───────────────────────

-- Via document_id -> nf_documents.firm_id
create policy tenant_rw on public.nf_comments
  for all to authenticated
  using ( public.auth_is_super() or exists (
    select 1 from public.nf_documents d
    where d.id = nf_comments.document_id and d.firm_id = public.auth_firm_id() ) )
  with check ( public.auth_is_super() or exists (
    select 1 from public.nf_documents d
    where d.id = nf_comments.document_id and d.firm_id = public.auth_firm_id() ) );

create policy tenant_rw on public.nf_document_permissions
  for all to authenticated
  using ( public.auth_is_super() or exists (
    select 1 from public.nf_documents d
    where d.id = nf_document_permissions.document_id and d.firm_id = public.auth_firm_id() ) )
  with check ( public.auth_is_super() or exists (
    select 1 from public.nf_documents d
    where d.id = nf_document_permissions.document_id and d.firm_id = public.auth_firm_id() ) );

create policy tenant_rw on public.nf_document_versions
  for all to authenticated
  using ( public.auth_is_super() or exists (
    select 1 from public.nf_documents d
    where d.id = nf_document_versions.document_id and d.firm_id = public.auth_firm_id() ) )
  with check ( public.auth_is_super() or exists (
    select 1 from public.nf_documents d
    where d.id = nf_document_versions.document_id and d.firm_id = public.auth_firm_id() ) );

-- Via path_id -> nf_training_paths.firm_id
create policy tenant_rw on public.nf_training_steps
  for all to authenticated
  using ( public.auth_is_super() or exists (
    select 1 from public.nf_training_paths p
    where p.id = nf_training_steps.path_id and p.firm_id = public.auth_firm_id() ) )
  with check ( public.auth_is_super() or exists (
    select 1 from public.nf_training_paths p
    where p.id = nf_training_steps.path_id and p.firm_id = public.auth_firm_id() ) );

-- Via user_id -> nf_users.firm_id
create policy tenant_rw on public.nf_certificates
  for all to authenticated
  using ( public.auth_is_super() or exists (
    select 1 from public.nf_users u
    where u.id = nf_certificates.user_id and u.firm_id = public.auth_firm_id() ) )
  with check ( public.auth_is_super() or exists (
    select 1 from public.nf_users u
    where u.id = nf_certificates.user_id and u.firm_id = public.auth_firm_id() ) );

-- ── nf_firms (caso especial) ───────────────────────────────────────────────
-- Leitura PÚBLICA: a tela de login /[slug] precisa ler nome/segmento/cores da
-- firma ANTES de existir sessão. São dados de marca, não sensíveis.
create policy public_read on public.nf_firms
  for select to anon, authenticated using (true);

-- Escrita só autenticado: a própria firma (admin em Configurações) ou super-admin.
create policy firm_update on public.nf_firms
  for update to authenticated
  using ( id = public.auth_firm_id() or public.auth_is_super() )
  with check ( id = public.auth_firm_id() or public.auth_is_super() );

-- Criação de firma (novo cliente) só por super-admin. O auto-cadastro público
-- (/cadastro) passa a criar via /api/setup-firm com service role (ignora RLS).
create policy firm_insert on public.nf_firms
  for insert to authenticated
  with check ( public.auth_is_super() );

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK (se algo falhar no staging, reverter para o modelo permissivo):
--   Recriar as policies antigas `... for <cmd> to anon using (true)` por tabela.
--   Como este arquivo dropa as anon, guarde o snapshot do banco (point-in-time)
--   antes de aplicar. No branch de staging, basta descartar o branch.
-- ═══════════════════════════════════════════════════════════════════════════
