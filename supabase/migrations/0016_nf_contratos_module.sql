-- NexusFlow: Módulo Contratos (ZapSign integration)
-- Migration: 0016_nf_contratos_module

-- ============================================================
-- Table: nf_contratos
-- Stores contracts and powers of attorney synced from ZapSign
-- ============================================================
create table if not exists nf_contratos (
  id               bigserial primary key,
  firm_id          uuid not null references nf_firms(id) on delete cascade,
  zapsign_token    text unique,
  nome             text not null,
  tipo             text not null default 'contrato' check (tipo in ('contrato', 'procuracao')),
  categoria        text not null default 'Geral',
  telefone         text,
  email            text,
  data_assinatura  date,
  doc_juntado      boolean not null default false,
  pericia_marcada  boolean not null default false,
  pericia_data     date,
  observacao       text,
  synced_at        timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists nf_contratos_firm_idx on nf_contratos(firm_id);
create index if not exists nf_contratos_tipo_idx  on nf_contratos(firm_id, tipo);

-- ============================================================
-- Table: nf_contratos_access
-- Per-user access grants for the Contratos module
-- Admins always have access (enforced at application level)
-- ============================================================
create table if not exists nf_contratos_access (
  id          bigserial primary key,
  firm_id     uuid not null references nf_firms(id) on delete cascade,
  user_id     uuid not null references nf_users(id) on delete cascade,
  granted_by  uuid references nf_users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (firm_id, user_id)
);

create index if not exists nf_contratos_access_firm_idx on nf_contratos_access(firm_id);

-- ============================================================
-- Table: nf_contratos_sync_log
-- Audit log for each ZapSign sync operation
-- ============================================================
create table if not exists nf_contratos_sync_log (
  id            bigserial primary key,
  firm_id       uuid not null references nf_firms(id) on delete cascade,
  synced_by     uuid references nf_users(id) on delete set null,
  total_found   int not null default 0,
  total_new     int not null default 0,
  total_updated int not null default 0,
  status        text not null default 'success',
  error_msg     text,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- Auto-update updated_at on nf_contratos
-- ============================================================
create or replace function nf_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists nf_contratos_updated_at on nf_contratos;
create trigger nf_contratos_updated_at
  before update on nf_contratos
  for each row execute function nf_set_updated_at();
