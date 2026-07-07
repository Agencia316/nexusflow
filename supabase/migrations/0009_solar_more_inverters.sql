-- Mais marcas de inversor disponíveis no mercado brasileiro (inclui microinversores).

insert into nf_solar_brands (name, type, price_factor, is_partner, sort_order)
select v.name, v.type, v.price_factor, v.is_partner, v.sort_order
from (values
  ('Solis (Ginlong)','inversor', 1.00, false, 29),
  ('GoodWe','inversor',          1.03, false, 30),
  ('Sofar Solar','inversor',     0.98, false, 31),
  ('SAJ','inversor',             0.96, false, 32),
  ('Chint','inversor',           0.98, false, 33),
  ('Livoltek','inversor',        0.97, false, 34),
  ('Renovigi','inversor',        1.00, false, 35),
  ('Intelbras','inversor',       1.02, false, 36),
  ('Hoymiles (micro)','inversor',1.06, false, 37),
  ('APsystems (micro)','inversor',1.07,false, 38),
  ('Enphase (micro)','inversor', 1.20, false, 39)
) as v(name,type,price_factor,is_partner,sort_order)
where not exists (select 1 from nf_solar_brands b where b.name = v.name and b.type = 'inversor');
