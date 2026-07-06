-- Trilha de auditoria: registra cada vez que o super-admin "entra como cliente".
create table if not exists public.nf_impersonation_log (
  id uuid primary key default gen_random_uuid(),
  super_user_id uuid not null,
  firm_id uuid not null,
  created_at timestamptz not null default now()
);

alter table public.nf_impersonation_log enable row level security;
grant select, insert on public.nf_impersonation_log to authenticated;

-- Só super-admin registra e lê a trilha.
create policy super_insert on public.nf_impersonation_log
  for insert to authenticated with check ( public.auth_is_super() );
create policy super_select on public.nf_impersonation_log
  for select to authenticated using ( public.auth_is_super() );
