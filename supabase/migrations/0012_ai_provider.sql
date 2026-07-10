-- Suporte a múltiplos provedores de IA por firma (OpenAI / Anthropic).
--
-- Até aqui só havia OpenAI. A coluna `openai_api_key` passa a guardar a chave
-- do provedor escolhido — renomeá-la exigiria tocar código legado sem ganho
-- real, então o nome ficou, e `ai_provider` é quem diz como interpretá-la
-- (junto com `ai_model`).

alter table nf_firm_settings
  add column if not exists ai_provider text not null default 'openai';

alter table nf_firm_settings
  drop constraint if exists nf_firm_settings_ai_provider_check;

alter table nf_firm_settings
  add constraint nf_firm_settings_ai_provider_check
  check (ai_provider in ('openai', 'anthropic'));

-- Firmas existentes já usam OpenAI: o default cobre, mas explicitar evita
-- qualquer linha com NULL vinda de inserts anteriores ao default.
update nf_firm_settings set ai_provider = 'openai' where ai_provider is null;

comment on column nf_firm_settings.ai_provider is
  'Provedor de IA da firma: openai | anthropic. Define como openai_api_key e ai_model são interpretados.';

-- O SELECT nesta tabela é concedido COLUNA A COLUNA, justamente para que
-- `openai_api_key` nunca seja legível pelo cliente. Uma coluna nova não herda
-- esse grant: sem a linha abaixo, a tela de Configurações leva 403 ao ler
-- `ai_provider` e o bloco de IA some da página inteira.
grant select (ai_provider) on nf_firm_settings to authenticated, anon;
