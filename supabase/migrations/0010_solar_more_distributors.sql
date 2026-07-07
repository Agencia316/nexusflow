-- Mais distribuidores/fornecedores do mercado solar brasileiro (WEG como parceiro).

insert into nf_solar_brands (name, type, price_factor, is_partner, sort_order)
select v.name, v.type, v.price_factor, v.is_partner, v.sort_order
from (values
  ('WEG','distribuidor',            1.00, true,  40),
  ('Fortlev Solar','distribuidor',  1.00, false, 41),
  ('Ecori Energia Solar','distribuidor', 1.00, false, 42),
  ('Sunne','distribuidor',          1.00, false, 43),
  ('Minha Casa Solar','distribuidor',1.00,false, 44),
  ('Aldabra','distribuidor',        1.00, false, 45),
  ('Neosolar','distribuidor',       1.00, false, 46),
  ('Solfácil','distribuidor',       1.00, false, 47),
  ('Kingdom Solar','distribuidor',  1.00, false, 48)
) as v(name,type,price_factor,is_partner,sort_order)
where not exists (select 1 from nf_solar_brands b where b.name = v.name and b.type = 'distribuidor');
