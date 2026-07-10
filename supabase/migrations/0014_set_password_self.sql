-- Troca da própria senha, com verificação da senha atual. Chamada apenas pela
-- rota /api/account/password (service_role), que passa o user_id derivado do
-- token da sessão — nunca do corpo. Restrita a service_role: o cliente não a
-- alcança direto.
create or replace function public.nf_set_password_self(p_user_id uuid, p_current text, p_new text)
returns text
language plpgsql
security definer
as $function$
declare v_hash text;
begin
  if p_new is null or length(p_new) < 6 then return 'weak'; end if;

  select password_bcrypt into v_hash from nf_users where id = p_user_id;
  if not found then return 'notfound'; end if;

  -- Senha atual tem que bater.
  if v_hash is null or v_hash <> crypt(p_current, v_hash) then return 'wrong'; end if;

  update nf_users
     set password_bcrypt = crypt(p_new, gen_salt('bf', 10)),
         password_hash = null
   where id = p_user_id;
  return 'ok';
end;
$function$;

revoke execute on function public.nf_set_password_self(uuid, text, text) from public, anon, authenticated;
grant  execute on function public.nf_set_password_self(uuid, text, text) to service_role;
