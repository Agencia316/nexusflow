-- Endurecimento de segurança:
--   (1) elimina senhas em texto puro (só bcrypt no login)
--   (2) impede o cliente de ler a chave de IA de qualquer firma

-- 1. Garante bcrypt e remove o texto puro.
update nf_users
set password_bcrypt = crypt(password_hash, gen_salt('bf'))
where password_bcrypt is null and password_hash is not null;

alter table nf_users alter column password_hash drop not null;
update nf_users set password_hash = null;

-- nf_login sem fallback de texto puro (mantém is_super_admin).
create or replace function public.nf_login(p_email text, p_password text)
returns table(
  id uuid, name text, email text, role text,
  firm_id uuid, job_role_id uuid, is_super_admin boolean
)
language plpgsql
security definer
as $function$
begin
  return query
  select u.id, u.name, u.email, u.role, u.firm_id, u.job_role_id, u.is_super_admin
  from nf_users u
  where u.email = p_email and u.is_active = true
    and u.password_bcrypt is not null
    and u.password_bcrypt = crypt(p_password, u.password_bcrypt);
end;
$function$;

-- 2. openai_api_key deixa de ser legível pelo anon (só colunas públicas).
--    O servidor lê a chave via service_role (ignora estas restrições).
revoke select on nf_firm_settings from anon, authenticated;
grant select (
  id, firm_id, smtp_from, brand_color, logo_url, created_at,
  ai_model, ai_enabled, chat_system_prompt, chat_welcome,
  chat_suggestions, chat_persona
) on nf_firm_settings to anon, authenticated;

-- Permite ao cliente saber SE há chave, sem expô-la.
create or replace function public.nf_has_ai_key(p_firm_id uuid)
returns boolean
language sql
security definer
stable
as $function$
  select coalesce(
    (select openai_api_key is not null and length(trim(openai_api_key)) > 0
     from nf_firm_settings where firm_id = p_firm_id),
    false);
$function$;

grant execute on function public.nf_has_ai_key(uuid) to anon, authenticated;
