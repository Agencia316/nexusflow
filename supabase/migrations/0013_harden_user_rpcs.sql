-- Correção de segurança (crítica).
--
-- nf_update_password e nf_create_user eram SECURITY DEFINER com EXECUTE para o
-- PUBLIC (logo, para `anon`), sem checar quem chama. Como a anon key é pública
-- (está no bundle do cliente), qualquer um — SEM LOGIN — trocava a senha de
-- qualquer usuário (inclusive o super-admin) ou injetava um usuário admin em
-- qualquer firma. As três funções abaixo ainda gravavam a senha em TEXTO PURO
-- na coluna legada password_hash.
--
-- Correção:
--   1. Autorizar pelas claims do JWT da sessão (auth_is_super / auth_firm_id /
--      sub / user_role). Envolver a expressão inteira em coalesce(..., false):
--      sem isso, para o anon a condição vira NULL (lógica de três valores), e
--      em PL/pgSQL `if not (NULL)` NÃO dispara o raise — passava direto.
--   2. Nunca mais gravar texto puro (password_hash = null).
--   3. Revogar EXECUTE do PUBLIC (não só de anon — o grant default de função é
--      para PUBLIC) e conceder só a authenticated/service_role.
--   4. Purgar o texto puro já existente.
--
-- nf_login e nf_create_firm seguem chamáveis por anon de propósito (login e
-- cadastro público), mas nf_create_firm também para de gravar texto puro.

-- ── nf_update_password: super | o próprio usuário | admin da MESMA firma ──
create or replace function public.nf_update_password(p_user_id uuid, p_new_password text)
returns boolean
language plpgsql
security definer
as $function$
declare
  v_caller uuid := nullif(auth.jwt() ->> 'sub', '')::uuid;
  v_role   text := auth.jwt() ->> 'user_role';
  v_target_firm uuid;
begin
  if p_new_password is null or length(p_new_password) < 6 then
    raise exception 'A senha precisa ter pelo menos 6 caracteres.';
  end if;

  select firm_id into v_target_firm from nf_users where id = p_user_id;
  if not found then return false; end if;

  if not coalesce(
       public.auth_is_super()
       or (v_caller is not null and v_caller = p_user_id)
       or (v_role = 'admin'
           and public.auth_firm_id() is not null
           and v_target_firm = public.auth_firm_id())
     , false) then
    raise exception 'Sem permissão para alterar esta senha.';
  end if;

  update nf_users
     set password_bcrypt = crypt(p_new_password, gen_salt('bf', 10)),
         password_hash = null
   where id = p_user_id;
  return found;
end;
$function$;

-- ── nf_create_user: super | admin criando na PRÓPRIA firma ──
create or replace function public.nf_create_user(
  p_firm_id uuid, p_name text, p_email text, p_password text,
  p_role text, p_job_role_id uuid default null
)
returns uuid
language plpgsql
security definer
as $function$
declare v_id uuid;
begin
  if not coalesce(
       public.auth_is_super()
       or ((auth.jwt() ->> 'user_role') = 'admin'
           and public.auth_firm_id() is not null
           and p_firm_id = public.auth_firm_id())
     , false) then
    raise exception 'Sem permissão para criar usuário nesta firma.';
  end if;

  insert into nf_users(firm_id, name, email, password_bcrypt, role, job_role_id)
  values (p_firm_id, p_name, p_email, crypt(p_password, gen_salt('bf', 10)), p_role, p_job_role_id)
  returning id into v_id;
  return v_id;
end;
$function$;

-- ── nf_create_firm: cadastro público (anon), mas sem gravar texto puro ──
create or replace function public.nf_create_firm(
  p_name text, p_slug text, p_segment text,
  p_admin_name text, p_admin_email text, p_admin_password text
)
returns jsonb
language plpgsql
security definer
as $function$
declare v_firm_id uuid; v_user_id uuid;
begin
  if exists (select 1 from nf_firms where slug = p_slug) then
    return jsonb_build_object('error', 'Esse slug já está em uso. Tente outro nome.');
  end if;
  if exists (select 1 from nf_users where email = p_admin_email) then
    return jsonb_build_object('error', 'Esse e-mail já está cadastrado.');
  end if;

  insert into nf_firms (name, slug, segment, status, created_by_email, primary_color, accent_color)
  values (p_name, p_slug, p_segment, 'trial', p_admin_email,
    case p_segment when 'solar' then '#0f2027' else '#0f172a' end,
    case p_segment when 'solar' then '#f59e0b' else '#d4a017' end)
  returning id into v_firm_id;

  insert into nf_users (firm_id, name, email, password_bcrypt, role, is_active)
  values (v_firm_id, p_admin_name, p_admin_email,
    crypt(p_admin_password, gen_salt('bf', 10)), 'admin', true)
  returning id into v_user_id;

  return jsonb_build_object('firm_id', v_firm_id, 'user_id', v_user_id, 'slug', p_slug, 'segment', p_segment);
end;
$function$;

-- Fechar o PUBLIC (é ele que deixava o anon entrar) e conceder só a quem deve.
revoke execute on function public.nf_update_password(uuid, text) from public, anon;
grant  execute on function public.nf_update_password(uuid, text) to authenticated, service_role;

revoke execute on function public.nf_create_user(uuid, text, text, text, text, uuid) from public, anon;
grant  execute on function public.nf_create_user(uuid, text, text, text, text, uuid) to authenticated, service_role;

-- Purgar o texto puro já gravado (login usa só password_bcrypt).
update nf_users set password_hash = null where password_hash is not null;
