-- Opção "Paraná (todo o estado)" + mais marcas de painel de mercado.

insert into nf_solar_tariffs (uf, region_label, concessionaria, tariff_kwh, hsp, sort_order)
select 'PR','Paraná (todo o estado)','Copel', 0.99, 4.60, 6
where not exists (select 1 from nf_solar_tariffs where region_label = 'Paraná (todo o estado)');

insert into nf_solar_brands (name, type, panel_watt, price_factor, is_partner, sort_order)
select v.name, v.type, v.panel_watt, v.price_factor, v.is_partner, v.sort_order
from (values
  ('Longi Solar','painel', 585, 1.06, false, 7),
  ('Risen Energy','painel', 590, 1.00, false, 8),
  ('Astronergy','painel',   580, 0.99, false, 9),
  ('ZNShine Solar','painel',585, 0.97, false, 16),
  ('Sunova Solar','painel', 580, 0.98, false, 17),
  ('Leapton','painel',      580, 0.98, false, 18),
  ('Osda Solar','painel',   575, 0.96, false, 19),
  ('Q Cells','painel',      580, 1.10, false, 24),
  ('GCL','painel',          580, 0.99, false, 25),
  ('Talesun','painel',      575, 0.98, false, 26),
  ('Intelbras','painel',    555, 1.02, false, 27),
  ('WEG','painel',          550, 1.10, true,  28)
) as v(name,type,panel_watt,price_factor,is_partner,sort_order)
where not exists (select 1 from nf_solar_brands b where b.name = v.name and b.type = 'painel');
