-- =====================================================================
-- Luma — suporte ao cliente (chamados e mensagens)
--
-- Como aplicar: Supabase → SQL Editor → New query → cole este arquivo
-- inteiro → Run. Rode DEPOIS do 0001, 0002 e 0003. Pode ser executado mais de
-- uma vez (é idempotente).
--
-- Quem pode o quê (verificado pelo banco):
--  * Usuário ativo de uma empresa: abre chamados da própria empresa, lê e
--    responde só os chamados dela.
--  * Dono da plataforma (platform_admins + 2 etapas): vê e responde todos.
--  * Ninguém acessa as tabelas diretamente: tudo passa pelas funções abaixo.
-- =====================================================================

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  subject text not null check (char_length(subject) between 3 and 120),
  status text not null default 'aberto' check (status in ('aberto', 'respondido', 'fechado')),
  unread_admin boolean not null default true,
  unread_client boolean not null default false,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  author_role text not null check (author_role in ('cliente', 'suporte')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_org_idx on public.support_tickets (org_id, last_message_at desc);
create index if not exists support_tickets_last_idx on public.support_tickets (last_message_at desc);
create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, id);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
-- sem policies: nenhum acesso direto às tabelas
revoke all on public.support_tickets from anon, authenticated;
revoke all on public.support_messages from anon, authenticated;

-- ---------------------------------------------------------------------
-- Cliente
-- ---------------------------------------------------------------------

-- Abre um chamado com a primeira mensagem. Limite de 10 chamados por usuário a cada 24 h.
create or replace function public.support_open(p_org uuid, p_subject text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.luma_can_read(p_org) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  if (select count(*) from public.support_tickets where created_by = auth.uid() and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'limite de chamados atingido; tente novamente mais tarde ou fale pelo WhatsApp';
  end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then
    raise exception 'escreva sua mensagem';
  end if;
  insert into public.support_tickets (org_id, created_by, subject)
  values (p_org, auth.uid(), left(trim(coalesce(nullif(trim(p_subject), ''), 'Ajuda')), 120))
  returning id into v_id;
  insert into public.support_messages (ticket_id, author_id, author_role, body)
  values (v_id, auth.uid(), 'cliente', left(trim(p_body), 4000));
  return v_id;
end;
$$;

-- Chamados da empresa (mais recentes primeiro).
create or replace function public.support_list(p_org uuid)
returns table (id uuid, subject text, status text, unread boolean, created_at timestamptz, last_message_at timestamptz, last_body text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.luma_can_read(p_org) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return query
  select t.id, t.subject, t.status, t.unread_client, t.created_at, t.last_message_at,
         (select left(m.body, 140) from public.support_messages m where m.ticket_id = t.id order by m.id desc limit 1)
    from public.support_tickets t
   where t.org_id = p_org
   order by t.last_message_at desc
   limit 100;
end;
$$;

-- Pode ver/participar do chamado? Retorna 'suporte', 'cliente' ou nulo.
create or replace function public.support_role(p_ticket uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
           when public.is_platform_admin() then 'suporte'
           when exists (select 1 from public.support_tickets t where t.id = p_ticket and public.luma_can_read(t.org_id)) then 'cliente'
         end;
$$;

-- Mensagens do chamado; marca como lido para quem está vendo.
create or replace function public.support_thread(p_ticket uuid)
returns table (id bigint, author_role text, author_email text, body text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.support_role(p_ticket);
begin
  if v_role is null then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  if v_role = 'suporte' then
    update public.support_tickets set unread_admin = false where support_tickets.id = p_ticket and unread_admin;
  else
    update public.support_tickets set unread_client = false where support_tickets.id = p_ticket and unread_client;
  end if;
  return query
  select m.id, m.author_role,
         case when m.author_role = 'cliente' then u.email::text else null end,
         m.body, m.created_at
    from public.support_messages m
    left join auth.users u on u.id = m.author_id
   where m.ticket_id = p_ticket
   order by m.id
   limit 500;
end;
$$;

-- Envia mensagem (cliente ou suporte; o papel vem do banco, não do navegador).
create or replace function public.support_send(p_ticket uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.support_role(p_ticket);
begin
  if v_role is null then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then
    raise exception 'escreva sua mensagem';
  end if;
  if v_role = 'cliente' and (select count(*) from public.support_messages where author_id = auth.uid() and created_at > now() - interval '1 minute') >= 15 then
    raise exception 'muitas mensagens seguidas; aguarde um instante';
  end if;
  insert into public.support_messages (ticket_id, author_id, author_role, body)
  values (p_ticket, auth.uid(), v_role, left(trim(p_body), 4000));
  update public.support_tickets
     set last_message_at = now(),
         status = case when v_role = 'suporte' then 'respondido' else 'aberto' end,
         unread_admin = (v_role = 'cliente'),
         unread_client = (v_role = 'suporte')
   where id = p_ticket;
end;
$$;

-- Encerrar/reabrir: o suporte pode tudo; o cliente pode encerrar ou reabrir chamados da empresa.
create or replace function public.support_set_status(p_ticket uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.support_role(p_ticket);
begin
  if v_role is null then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  if p_status not in ('aberto', 'respondido', 'fechado') or (v_role = 'cliente' and p_status = 'respondido') then
    raise exception 'situação inválida';
  end if;
  update public.support_tickets set status = p_status where id = p_ticket;
end;
$$;

-- ---------------------------------------------------------------------
-- Painel do dono da plataforma
-- ---------------------------------------------------------------------

create or replace function public.admin_support_list(p_status text default null)
returns table (id uuid, org_id uuid, org_name text, subject text, status text, unread boolean,
               requester_email text, created_at timestamptz, last_message_at timestamptz, last_body text, last_role text)
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
  select t.id, t.org_id, o.name, t.subject, t.status, t.unread_admin, u.email::text, t.created_at, t.last_message_at,
         lm.body, lm.author_role
    from public.support_tickets t
    join public.organizations o on o.id = t.org_id
    left join auth.users u on u.id = t.created_by
    left join lateral (select left(m.body, 140) as body, m.author_role from public.support_messages m where m.ticket_id = t.id order by m.id desc limit 1) lm on true
   where p_status is null or t.status = p_status
   order by t.unread_admin desc, t.last_message_at desc
   limit 300;
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------

revoke all on function public.support_open(uuid, text, text) from public, anon;
revoke all on function public.support_list(uuid) from public, anon;
revoke all on function public.support_role(uuid) from public, anon;
revoke all on function public.support_thread(uuid) from public, anon;
revoke all on function public.support_send(uuid, text) from public, anon;
revoke all on function public.support_set_status(uuid, text) from public, anon;
revoke all on function public.admin_support_list(text) from public, anon;

grant execute on function public.support_open(uuid, text, text) to authenticated;
grant execute on function public.support_list(uuid) to authenticated;
grant execute on function public.support_thread(uuid) to authenticated;
grant execute on function public.support_send(uuid, text) to authenticated;
grant execute on function public.support_set_status(uuid, text) to authenticated;
grant execute on function public.admin_support_list(text) to authenticated;
