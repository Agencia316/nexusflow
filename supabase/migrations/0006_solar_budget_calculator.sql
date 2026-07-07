-- Calculadora de orçamento solar: dados de referência por região (tarifa/HSP),
-- marcas/fornecedores, faixas de preço por kWp, e contatos da empresa no orçamento.

-- ── Tabelas de referência (globais) ──
create table if not exists nf_solar_tariffs (
  id uuid primary key default gen_random_uuid(),
  uf text not null,
  region_label text not null,
  concessionaria text,
  tariff_kwh numeric not null,
  hsp numeric not null default 4.6,
  active boolean default true,
  sort_order int default 0,
  updated_at timestamptz default now()
);

create table if not exists nf_solar_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('painel','inversor','distribuidor')),
  is_partner boolean default false,
  panel_watt integer,
  price_factor numeric default 1.0,
  ufs text[] default '{}',
  active boolean default true,
  sort_order int default 0
);

create table if not exists nf_solar_pricing (
  id uuid primary key default gen_random_uuid(),
  min_kwp numeric not null,
  max_kwp numeric,
  price_per_kwp numeric not null,
  sort_order int default 0
);

-- ── Contatos da empresa usados no PDF/WhatsApp do orçamento (em nf_firms,
-- que já é legível pela anon key — o iframe da ferramenta lê daqui). ──
alter table nf_firms
  add column if not exists budget_whatsapp text,
  add column if not exists budget_phone text,
  add column if not exists budget_cnpj text,
  add column if not exists budget_site text,
  add column if not exists budget_address text;

-- ── RLS: dados de referência são de leitura pública; escrita só via service role
-- (a UI de admin grava por /api/solar-config, que verifica JWT de super admin). ──
alter table nf_solar_tariffs enable row level security;
alter table nf_solar_brands  enable row level security;
alter table nf_solar_pricing enable row level security;

drop policy if exists "public read tariffs" on nf_solar_tariffs;
drop policy if exists "public read brands"  on nf_solar_brands;
drop policy if exists "public read pricing" on nf_solar_pricing;
create policy "public read tariffs" on nf_solar_tariffs for select using (true);
create policy "public read brands"  on nf_solar_brands  for select using (true);
create policy "public read pricing" on nf_solar_pricing for select using (true);

-- ── Seed inicial (idempotente) ──
insert into nf_solar_tariffs (uf, region_label, concessionaria, tariff_kwh, hsp, sort_order)
select * from (values
  ('PR','Irati e região (raio 150 km)','Copel', 0.99, 4.60, 1),
  ('PR','Ponta Grossa e Campos Gerais','Copel', 0.99, 4.65, 2),
  ('PR','Guarapuava e Centro-Sul','Copel', 0.99, 4.60, 3),
  ('PR','União da Vitória e Sul','Copel', 0.99, 4.55, 4),
  ('PR','Curitiba e Região Metropolitana','Copel', 0.99, 4.45, 5)
) as v(uf,region_label,concessionaria,tariff_kwh,hsp,sort_order)
where not exists (select 1 from nf_solar_tariffs);

insert into nf_solar_pricing (min_kwp, max_kwp, price_per_kwp, sort_order)
select * from (values
  (0::numeric, 5::numeric,   4200::numeric, 1),
  (5,   10,  3800, 2),
  (10,  30,  3400, 3),
  (30,  75,  3100, 4),
  (75,  null,2900, 5)
) as v(min_kwp,max_kwp,price_per_kwp,sort_order)
where not exists (select 1 from nf_solar_pricing);

insert into nf_solar_brands (name, type, panel_watt, price_factor, is_partner, sort_order)
select * from (values
  ('Canadian Solar','painel', 585, 1.08, false, 1),
  ('Trina Solar','painel',    600, 1.05, false, 2),
  ('JA Solar','painel',       580, 1.03, false, 3),
  ('Jinko Solar','painel',    575, 1.02, false, 4),
  ('DAH Solar','painel',      585, 0.98, false, 5),
  ('BYD','painel',            550, 1.00, false, 6),
  ('Growatt','inversor',      null, 1.00, false, 10),
  ('Deye','inversor',         null, 1.02, false, 11),
  ('Sungrow','inversor',      null, 1.05, false, 12),
  ('Fronius','inversor',      null, 1.15, false, 13),
  ('Huawei','inversor',       null, 1.08, false, 14),
  ('WEG','inversor',          null, 1.10, true,  15),
  ('Aldo Solar','distribuidor',   null, 1.00, false, 20),
  ('Edeltec','distribuidor',      null, 1.00, false, 21),
  ('Belenus','distribuidor',      null, 1.00, false, 22),
  ('Soline','distribuidor',       null, 1.00, false, 23)
) as v(name,type,panel_watt,price_factor,is_partner,sort_order)
where not exists (select 1 from nf_solar_brands);
