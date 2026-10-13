-- =====================================================================
-- Luma — estrutura da plataforma (empresas, administradores, convites)
--
-- Como aplicar: Supabase → SQL Editor → New query → cole este arquivo
-- inteiro → Run. Pode ser executado mais de uma vez (é idempotente).
--
-- Segurança:
--  * Todas as tabelas têm Row Level Security (RLS) ligada.
--  * O painel do dono da Luma exige usuário cadastrado em platform_admins
--    E sessão com verificação em duas etapas (aal2).
--  * Tokens de convite são aleatórios (32 bytes) e só o hash SHA-256 fica salvo.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  cnpj text check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  responsible_name text not null check (char_length(responsible_name) between 2 and 120),
  responsible_email text not null check (responsible_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  licenses integer not null check (licenses between 1 and 10),
  monthly_price_cents integer not null check (monthly_price_cents >= 0),
  next_due_date date,
  status text not null default 'ativa' check (status in ('ativa', 'inadimplente', 'suspensa', 'cancelada')),
  sale_origin text not null default 'manual',
  admin_notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('administrador', 'financeiro', 'consulta')),
  status text not null default 'ativo' check (status in ('ativo', 'desativado')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role text not null default 'administrador' check (role in ('administrador', 'financeiro', 'consulta')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id),
  revoked_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor uuid references auth.users (id),
  action text not null,
  org_id uuid references public.organizations (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists invitations_org_idx on public.invitations (org_id);
create index if not exists memberships_user_idx on public.memberships (user_id);
create index if not exists audit_created_idx on public.admin_audit_log (created_at desc);

-- ---------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------

-- Dono/administrador da plataforma com sessão em duas etapas (aal2).
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- Está cadastrado como administrador da plataforma (mesmo sem 2 etapas ainda).
-- Usado só para a tela saber que precisa pedir a verificação em duas etapas.
create or replace function public.am_i_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.luma_hash_token(p_token text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

create or replace function public.luma_new_invite(p_org uuid, p_email text, p_role text, p_actor uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  -- revoga convites anteriores ainda não usados para o mesmo e-mail
  update public.invitations
     set revoked_at = now()
   where org_id = p_org and lower(email) = lower(p_email) and accepted_at is null and revoked_at is null;

  insert into public.invitations (org_id, email, role, token_hash, expires_at, created_by)
  values (p_org, lower(p_email), p_role, public.luma_hash_token(v_token), now() + interval '7 days', p_actor);

  return v_token;
end;
$$;

-- ---------------------------------------------------------------------
-- Funções do painel administrativo (todas exigem is_platform_admin)
-- ---------------------------------------------------------------------

create or replace function public.admin_create_organization(
  p_name text,
  p_cnpj text,
  p_responsible_name text,
  p_responsible_email text,
  p_licenses integer,
  p_monthly_price_cents integer,
  p_next_due_date date,
  p_sale_origin text,
  p_admin_notes text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_token text;
begin
  if not public.is_platform_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  insert into public.organizations (name, cnpj, responsible_name, responsible_email, licenses, monthly_price_cents,
                                    next_due_date, sale_origin, admin_notes, created_by)
  values (trim(p_name), nullif(regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g'), ''), trim(p_responsible_name),
          lower(trim(p_responsible_email)), p_licenses, p_monthly_price_cents, p_next_due_date,
          coalesce(nullif(trim(p_sale_origin), ''), 'manual'), nullif(trim(coalesce(p_admin_notes, '')), ''), auth.uid())
  returning id into v_org;

  v_token := public.luma_new_invite(v_org, p_responsible_email, 'administrador', auth.uid());

  insert into public.admin_audit_log (actor, action, org_id, details)
  values (auth.uid(), 'empresa_criada', v_org,
          json_build_object('nome', p_name, 'licencas', p_licenses, 'valor_centavos', p_monthly_price_cents, 'origem', p_sale_origin)::jsonb);

  return json_build_object('org_id', v_org, 'token', v_token);
end;
$$;

create or replace function public.admin_update_organization(
  p_org uuid,
  p_licenses integer,
  p_monthly_price_cents integer,
  p_next_due_date date,
  p_status text,
  p_admin_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.organizations;
  v_active integer;
begin
  if not public.is_platform_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  select * into v_old from public.organizations where id = p_org for update;
  if not found then
    raise exception 'empresa não encontrada';
  end if;

  select count(*) into v_active from public.memberships where org_id = p_org and status = 'ativo';
  if p_licenses < v_active then
    raise exception 'a empresa tem % usuários ativos; desative usuários antes de reduzir as licenças', v_active;
  end if;

  update public.organizations
     set licenses = p_licenses,
         monthly_price_cents = p_monthly_price_cents,
         next_due_date = p_next_due_date,
         status = p_status,
         admin_notes = nullif(trim(coalesce(p_admin_notes, '')), ''),
         updated_at = now()
   where id = p_org;

  insert into public.admin_audit_log (actor, action, org_id, details)
  values (auth.uid(), 'empresa_atualizada', p_org, json_build_object(
    'antes', json_build_object('licencas', v_old.licenses, 'valor_centavos', v_old.monthly_price_cents, 'status', v_old.status, 'vencimento', v_old.next_due_date),
    'depois', json_build_object('licencas', p_licenses, 'valor_centavos', p_monthly_price_cents, 'status', p_status, 'vencimento', p_next_due_date)
  )::jsonb);
end;
$$;

create or replace function public.admin_regenerate_invite(p_org uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations;
  v_token text;
begin
  if not public.is_platform_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  select * into v_org from public.organizations where id = p_org;
  if not found then
    raise exception 'empresa não encontrada';
  end if;
  v_token := public.luma_new_invite(p_org, v_org.responsible_email, 'administrador', auth.uid());
  insert into public.admin_audit_log (actor, action, org_id, details)
  values (auth.uid(), 'convite_reenviado', p_org, json_build_object('email', v_org.responsible_email)::jsonb);
  return v_token;
end;
$$;

-- Lista de empresas com contagem de usuários e situação do convite.
create or replace function public.admin_list_organizations()
returns table (
  id uuid,
  name text,
  cnpj text,
  responsible_name text,
  responsible_email text,
  licenses integer,
  monthly_price_cents integer,
  next_due_date date,
  status text,
  sale_origin text,
  admin_notes text,
  created_at timestamptz,
  active_users bigint,
  invite_status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return query
  select o.id, o.name, o.cnpj, o.responsible_name, o.responsible_email, o.licenses, o.monthly_price_cents,
         o.next_due_date, o.status, o.sale_origin, o.admin_notes, o.created_at,
         (select count(*) from public.memberships m where m.org_id = o.id and m.status = 'ativo'),
         case
           when exists (select 1 from public.invitations i where i.org_id = o.id and i.accepted_at is not null) then 'ativado'
           when exists (select 1 from public.invitations i where i.org_id = o.id and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()) then 'pendente'
           else 'expirado'
         end
    from public.organizations o
   order by o.created_at desc;
end;
$$;

create or replace function public.admin_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return json_build_object(
    'total', (select count(*) from public.organizations),
    'ativas', (select count(*) from public.organizations where status = 'ativa'),
    'inadimplentes', (select count(*) from public.organizations where status = 'inadimplente'),
    'suspensas', (select count(*) from public.organizations where status = 'suspensa'),
    'canceladas', (select count(*) from public.organizations where status = 'cancelada'),
    'criadas_mes', (select count(*) from public.organizations where created_at >= date_trunc('month', now())),
    'licencas', (select coalesce(sum(licenses), 0) from public.organizations where status in ('ativa', 'inadimplente')),
    'usuarios_ativos', (select count(*) from public.memberships where status = 'ativo'),
    'receita_mensal_centavos', (select coalesce(sum(monthly_price_cents), 0) from public.organizations where status in ('ativa', 'inadimplente')),
    'convites_pendentes', (select count(*) from public.invitations where accepted_at is null and revoked_at is null and expires_at > now())
  );
end;
$$;

create or replace function public.admin_audit(p_limit integer default 50)
returns table (created_at timestamptz, action text, org_name text, actor_email text, details jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return query
  select a.created_at, a.action, o.name, u.email::text, a.details
    from public.admin_audit_log a
    left join public.organizations o on o.id = a.org_id
    left join auth.users u on u.id = a.actor
   order by a.created_at desc
   limit least(greatest(p_limit, 1), 200);
end;
$$;

-- ---------------------------------------------------------------------
-- Convite: consulta pública pelo token e aceite pelo usuário logado
-- ---------------------------------------------------------------------

create or replace function public.invitation_info(p_token text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v record;
begin
  select i.email, i.expires_at, i.accepted_at, i.revoked_at, o.name as org_name
    into v
    from public.invitations i
    join public.organizations o on o.id = i.org_id
   where i.token_hash = public.luma_hash_token(p_token);
  if not found then
    return json_build_object('valid', false, 'reason', 'not_found');
  end if;
  if v.accepted_at is not null then
    return json_build_object('valid', false, 'reason', 'accepted', 'org_name', v.org_name);
  end if;
  if v.revoked_at is not null or v.expires_at <= now() then
    return json_build_object('valid', false, 'reason', 'expired', 'org_name', v.org_name);
  end if;
  return json_build_object('valid', true, 'org_name', v.org_name, 'email', v.email, 'expires_at', v.expires_at);
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.invitations;
  v_org_name text;
  v_used integer;
  v_licenses integer;
begin
  if auth.uid() is null then
    raise exception 'faça login para aceitar o convite' using errcode = '42501';
  end if;

  select * into v from public.invitations where token_hash = public.luma_hash_token(p_token) for update;
  if not found or v.revoked_at is not null or v.expires_at <= now() then
    raise exception 'convite inválido ou expirado';
  end if;
  if v.accepted_at is not null then
    raise exception 'este convite já foi utilizado';
  end if;
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> lower(v.email) then
    raise exception 'este convite foi enviado para outro e-mail';
  end if;

  select licenses, name into v_licenses, v_org_name from public.organizations where id = v.org_id for update;
  select count(*) into v_used from public.memberships where org_id = v.org_id and status = 'ativo';
  if v_used >= v_licenses then
    raise exception 'todas as licenças desta empresa já estão em uso';
  end if;

  insert into public.memberships (org_id, user_id, role)
  values (v.org_id, auth.uid(), v.role)
  on conflict (org_id, user_id) do update set status = 'ativo', role = excluded.role;

  update public.invitations set accepted_at = now(), accepted_by = auth.uid() where id = v.id;

  insert into public.admin_audit_log (actor, action, org_id, details)
  values (auth.uid(), 'convite_aceito', v.org_id, json_build_object('email', v.email)::jsonb);

  return json_build_object('org_id', v.org_id, 'org_name', v_org_name);
end;
$$;

-- Empresas das quais o usuário logado participa.
create or replace function public.my_organizations()
returns table (org_id uuid, name text, role text, status text)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.name, m.role, o.status
    from public.memberships m
    join public.organizations o on o.id = m.org_id
   where m.user_id = auth.uid() and m.status = 'ativo'
   order by o.name;
$$;

-- ---------------------------------------------------------------------
-- RLS: acesso direto às tabelas é fechado; tudo passa pelas funções acima
-- ---------------------------------------------------------------------

alter table public.platform_admins enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.admin_audit_log enable row level security;

drop policy if exists "admin lê empresas" on public.organizations;
create policy "admin lê empresas" on public.organizations for select using (public.is_platform_admin());

drop policy if exists "membro lê a própria empresa" on public.organizations;
create policy "membro lê a própria empresa" on public.organizations for select
  using (exists (select 1 from public.memberships m where m.org_id = organizations.id and m.user_id = auth.uid() and m.status = 'ativo'));

drop policy if exists "usuário lê seus vínculos" on public.memberships;
create policy "usuário lê seus vínculos" on public.memberships for select using (user_id = auth.uid() or public.is_platform_admin());

-- platform_admins, invitations e admin_audit_log: nenhuma policy = nenhum acesso direto.

-- Permissões de execução
revoke all on function public.admin_create_organization(text, text, text, text, integer, integer, date, text, text) from public, anon;
revoke all on function public.admin_update_organization(uuid, integer, integer, date, text, text) from public, anon;
revoke all on function public.admin_regenerate_invite(uuid) from public, anon;
revoke all on function public.admin_list_organizations() from public, anon;
revoke all on function public.admin_stats() from public, anon;
revoke all on function public.admin_audit(integer) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
revoke all on function public.my_organizations() from public, anon;
revoke all on function public.luma_new_invite(uuid, text, text, uuid) from public, anon, authenticated;

grant execute on function public.admin_create_organization(text, text, text, text, integer, integer, date, text, text) to authenticated;
grant execute on function public.admin_update_organization(uuid, integer, integer, date, text, text) to authenticated;
grant execute on function public.admin_regenerate_invite(uuid) to authenticated;
grant execute on function public.admin_list_organizations() to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_audit(integer) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.my_organizations() to authenticated;
grant execute on function public.am_i_platform_admin() to authenticated;
grant execute on function public.invitation_info(text) to anon, authenticated;
