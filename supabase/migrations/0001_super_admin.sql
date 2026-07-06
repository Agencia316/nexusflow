-- Multi-tenant super-admin (Três16) — coluna + nf_login retornando o campo.
alter table nf_users
  add column if not exists is_super_admin boolean not null default false;

drop function if exists nf_login(text, text);

create function nf_login(p_email text, p_password text)
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
    and (
      (u.password_bcrypt is not null and u.password_bcrypt = crypt(p_password, u.password_bcrypt))
      or u.password_hash = p_password
    );
end;
$function$;

grant execute on function nf_login(text, text) to anon, authenticated, service_role;

-- Marca o usuário master (ajuste o e-mail conforme necessário).
update nf_users set is_super_admin = true where email = 'will@tres16.com.br';
