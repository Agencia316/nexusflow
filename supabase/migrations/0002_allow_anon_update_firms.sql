-- Permite ao cliente atualizar a firma (painel admin: ativar/suspender, editar).
-- Também corrige o save do nome no /configuracoes, que não persistia por
-- falta de policy de UPDATE.
create policy allow_anon_update_firms on nf_firms
  for update to anon using (true) with check (true);
