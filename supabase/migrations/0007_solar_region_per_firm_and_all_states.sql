-- UF/região da empresa solar (escolhida no cadastro) + tarifas de todos os estados.
alter table nf_firms add column if not exists solar_uf text;

-- Uma linha de tarifa por estado (concessionária principal, valores-base editáveis).
-- PR já tem regiões detalhadas; só insere estados ainda não cobertos.
insert into nf_solar_tariffs (uf, region_label, concessionaria, tariff_kwh, hsp, sort_order)
select v.uf, v.region_label, v.concessionaria, v.tariff_kwh, v.hsp, v.sort_order
from (values
  ('AC','Acre','Energisa Acre',            1.02, 4.60, 101),
  ('AL','Alagoas','Equatorial Alagoas',    0.96, 5.40, 102),
  ('AP','Amapá','CEA Equatorial',          0.95, 4.80, 103),
  ('AM','Amazonas','Amazonas Energia',     0.99, 4.50, 104),
  ('BA','Bahia','Coelba (Neoenergia)',     0.98, 5.50, 105),
  ('CE','Ceará','Enel Ceará',              0.92, 5.60, 106),
  ('DF','Distrito Federal','Neoenergia Brasília', 0.95, 5.30, 107),
  ('ES','Espírito Santo','EDP ES',         0.93, 5.00, 108),
  ('GO','Goiás','Equatorial Goiás',        0.99, 5.40, 109),
  ('MA','Maranhão','Equatorial Maranhão',  0.97, 5.20, 110),
  ('MT','Mato Grosso','Energisa MT',       1.05, 5.30, 111),
  ('MS','Mato Grosso do Sul','Energisa MS',1.03, 5.20, 112),
  ('MG','Minas Gerais','Cemig',            1.00, 5.40, 113),
  ('PA','Pará','Equatorial Pará',          1.00, 4.90, 114),
  ('PB','Paraíba','Energisa Paraíba',      0.96, 5.50, 115),
  ('PE','Pernambuco','Neoenergia Celpe',   0.95, 5.50, 116),
  ('PI','Piauí','Equatorial Piauí',        0.98, 5.60, 117),
  ('RJ','Rio de Janeiro','Enel/Light',     1.05, 4.90, 118),
  ('RN','Rio Grande do Norte','Neoenergia Cosern', 0.95, 5.70, 119),
  ('RS','Rio Grande do Sul','RGE / CEEE',  0.97, 4.50, 120),
  ('RO','Rondônia','Energisa Rondônia',    1.00, 4.80, 121),
  ('RR','Roraima','Roraima Energia',       1.00, 4.90, 122),
  ('SC','Santa Catarina','Celesc',         0.94, 4.40, 123),
  ('SP','São Paulo','Enel/CPFL',           0.95, 4.90, 124),
  ('SE','Sergipe','Energisa Sergipe',      0.96, 5.40, 125),
  ('TO','Tocantins','Energisa Tocantins',  1.00, 5.30, 126)
) as v(uf,region_label,concessionaria,tariff_kwh,hsp,sort_order)
where not exists (select 1 from nf_solar_tariffs t where t.uf = v.uf);
