-- ROLLBACK da 0004 — restaura o estado permissivo anterior (anon using(true)).
-- Uso: se algo quebrar após ligar o RLS por tenant, aplicar este arquivo para
-- reverter em segundos, e desligar NEXT_PUBLIC_RLS_ENFORCED.

-- 1) Remove as policies novas + helpers da 0004
do $$
declare r record; alvo text[] := array[
  'nf_alerts','nf_assignments','nf_categories','nf_chat_messages','nf_chat_sessions',
  'nf_documents','nf_embeddings','nf_firm_settings','nf_roles','nf_training_paths',
  'nf_user_progress','nf_users','nf_comments','nf_document_permissions',
  'nf_document_versions','nf_training_steps','nf_certificates','nf_firms'];
begin
  for r in select tablename, policyname from pg_policies
           where schemaname='public' and tablename=any(alvo) loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

drop function if exists public.auth_firm_id();
drop function if exists public.auth_is_super();

-- 2) Recria as policies originais (capturadas antes de aplicar a 0004)
create policy allow_anon_all_alerts on public.nf_alerts for all to anon using (true);
create policy allow_anon_all_assignments on public.nf_assignments for all to anon using (true);
create policy allow_anon_all_categories on public.nf_categories for all to anon using (true);
create policy allow_anon_read_categories on public.nf_categories for select to anon using (true);
create policy allow_anon_all_certs on public.nf_certificates for all to anon using (true);
create policy allow_anon_all_chat on public.nf_chat_messages for all to anon using (true);
create policy allow_anon_all_chat_sessions on public.nf_chat_sessions for all to anon using (true);
create policy allow_anon_all_comments on public.nf_comments for all to anon using (true);
create policy allow_anon_all_doc_perms on public.nf_document_permissions for all to anon using (true);
create policy allow_anon_all_doc_versions on public.nf_document_versions for all to anon using (true);
create policy allow_anon_delete_documents on public.nf_documents for delete to anon using (true);
create policy allow_anon_insert_documents on public.nf_documents for insert to anon with check (true);
create policy allow_anon_read_documents on public.nf_documents for select to anon using (true);
create policy allow_anon_update_documents on public.nf_documents for update to anon using (true);
create policy allow_anon_all_embeddings on public.nf_embeddings for all to anon using (true);
create policy allow_anon_all_settings on public.nf_firm_settings for all to anon using (true);
create policy allow_anon_read_firms on public.nf_firms for select to anon using (true);
create policy allow_anon_update_firms on public.nf_firms for update to anon using (true) with check (true);
create policy anon_all_roles on public.nf_roles for all to public using (true) with check (true);
create policy allow_anon_all_training_paths on public.nf_training_paths for all to anon using (true);
create policy allow_anon_all_training_steps on public.nf_training_steps for all to anon using (true);
create policy allow_anon_all_progress on public.nf_user_progress for all to anon using (true);
create policy allow_anon_delete_users on public.nf_users for delete to anon using (true);
create policy allow_anon_insert_users on public.nf_users for insert to anon with check (true);
create policy allow_anon_read_users on public.nf_users for select to anon using (true);
create policy allow_anon_update_users on public.nf_users for update to anon using (true);
