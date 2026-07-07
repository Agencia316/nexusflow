-- Propostas de orçamento solar salvas, isoladas por firma (mesmo padrão RLS
-- das demais tabelas: tenant_rw com auth_firm_id() + auth_is_super()).
create table if not exists nf_solar_quotes (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  created_by uuid,
  created_by_name text,
  cliente_nome text,
  cliente_zap text,
  cliente_cidade text,
  regiao text,
  concessionaria text,
  tarifa numeric,
  painel text,
  painel_watt integer,
  inversor text,
  distribuidor text,
  kwp numeric,
  n_paineis integer,
  geracao numeric,
  cobertura numeric,
  consumo_kwh numeric,
  investimento numeric,
  parcela numeric,
  n_parcelas integer,
  economia_mes numeric,
  economia_ano numeric,
  payback_anos numeric,
  economia_25 numeric,
  status text default 'novo',
  created_at timestamptz default now()
);

create index if not exists nf_solar_quotes_firm_idx on nf_solar_quotes (firm_id, created_at desc);

alter table nf_solar_quotes enable row level security;
drop policy if exists tenant_rw on nf_solar_quotes;
create policy tenant_rw on nf_solar_quotes for all to authenticated
  using ((firm_id = auth_firm_id()) or auth_is_super())
  with check ((firm_id = auth_firm_id()) or auth_is_super());
