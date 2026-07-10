-- Snapshot da proposta no momento em que foi salva.
--
-- As colunas existentes guardam os RESULTADOS (kwp, investimento, payback), mas
-- não os parâmetros que os produziram: hsp, juros, inflação, custo de
-- disponibilidade, a série da projeção de 25 anos e os equipamentos como
-- objeto (a coluna `painel` guarda só o nome).
--
-- Sem isso, reabrir uma proposta antiga exige recalcular com as tarifas e
-- fatores de preço ATUAIS (editáveis em /app/admin/solar) — e uma proposta de
-- março recalculada em julho devolve outro número. Numa proposta comercial já
-- enviada ao cliente, isso é inaceitável.
--
-- O snapshot congela o objeto `last` da calculadora + o branding da firma no
-- instante do salvamento. A tela de detalhe renderiza a partir dele e regera o
-- PDF idêntico, sem depender de configuração que mudou depois.
--
-- Aditivo: linhas antigas ficam com snapshot null e caem no modo degradado
-- (mostram só os números já gravados nas colunas).
alter table nf_solar_quotes add column if not exists snapshot jsonb;

comment on column nf_solar_quotes.snapshot is
  'Congelamento dos parâmetros + resultados + branding no momento do salvamento. Null nas propostas anteriores à migration 0015.';
