-- =====================================================================
-- Luma Cardápio — cardápio digital de cada loja
--
-- Cada empresa (organizations) passa a ser uma loja com UM cardápio:
--   menus.slug      → endereço público do cardápio (ex.: "brasa-burger")
--   menus.published → só aparece para os clientes da loja quando publicado
--   menus.data      → loja, categorias, produtos, adicionais e cupons (JSON)
--
-- Acesso (verificado pelo próprio banco, RLS):
--  * Qualquer visitante lê o cardápio PUBLICADO de loja ativa ou
--    inadimplente, só pela função public_menu(slug).
--  * A loja lê o próprio cardápio; edita quem é administrador ou editor
--    (papel "financeiro" no banco) com a loja ativa ou inadimplente.
--  * O dono da plataforma (platform_admins + 2 etapas) lê e edita o
--    cardápio de qualquer loja, para montar a base antes de entregar.
--  * Fotos e vídeos: pasta pública "cardapio", caminho "<org_id>/<arquivo>";
--    só envia/apaga quem pode editar aquela loja.
--
-- Só acrescenta: nenhuma tabela, coluna ou dado existente é alterado.
-- Rode DEPOIS das migrações 0001 a 0006. Idempotente.
-- =====================================================================

create table if not exists public.menus (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$'),
  published boolean not null default false,
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 900000),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

drop trigger if exists menus_touch on public.menus;
create trigger menus_touch before insert or update on public.menus
  for each row execute function public.luma_touch_record();

alter table public.menus enable row level security;

drop policy if exists "loja lê o próprio cardápio" on public.menus;
create policy "loja lê o próprio cardápio" on public.menus
  for select to authenticated
  using (public.luma_can_read(org_id) or public.is_platform_admin());

drop policy if exists "loja cria o cardápio" on public.menus;
create policy "loja cria o cardápio" on public.menus
  for insert to authenticated
  with check (public.luma_can_write(org_id) or public.is_platform_admin());

drop policy if exists "loja altera o cardápio" on public.menus;
create policy "loja altera o cardápio" on public.menus
  for update to authenticated
  using (public.luma_can_write(org_id) or public.is_platform_admin())
  with check (public.luma_can_write(org_id) or public.is_platform_admin());

-- sem policy de exclusão: o cardápio só some junto com a loja

revoke all on public.menus from anon;
grant select, insert, update on public.menus to authenticated;

-- ---------------------------------------------------------------------
-- Leitura pública do cardápio publicado
-- ---------------------------------------------------------------------

create or replace function public.public_menu(p_slug text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object('slug', m.slug, 'data', m.data, 'updated_at', m.updated_at)
    from public.menus m
    join public.organizations o on o.id = m.org_id
   where m.slug = lower(trim(p_slug))
     and m.published
     and o.status in ('ativa', 'inadimplente');
$$;

revoke all on function public.public_menu(text) from public;
grant execute on function public.public_menu(text) to anon, authenticated;

-- Endereço livre? (o editor avisa antes de salvar; a restrição unique garante)
create or replace function public.menu_slug_available(p_slug text, p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.menus where slug = lower(trim(p_slug)) and org_id <> p_org);
$$;

revoke all on function public.menu_slug_available(text, uuid) from public, anon;
grant execute on function public.menu_slug_available(text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Administração: trocar o responsável antes da ativação
-- (a loja pode ser montada antes de o cliente assinar; o e-mail
--  definitivo chega depois)
-- ---------------------------------------------------------------------

create or replace function public.admin_set_responsible(p_org uuid, p_name text, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if not public.is_platform_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'informe o nome do responsável';
  end if;
  if trim(coalesce(p_email, '')) !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'informe um e-mail válido';
  end if;
  if exists (select 1 from public.invitations where org_id = p_org and accepted_at is not null) then
    raise exception 'o acesso desta loja já foi ativado; o responsável não pode mais ser trocado por aqui';
  end if;

  update public.organizations
     set responsible_name = trim(p_name), responsible_email = lower(trim(p_email)), updated_at = now()
   where id = p_org;
  if not found then
    raise exception 'loja não encontrada';
  end if;

  -- convites anteriores (para o e-mail antigo) deixam de valer
  update public.invitations set revoked_at = now()
   where org_id = p_org and accepted_at is null and revoked_at is null;

  v_token := public.luma_new_invite(p_org, p_email, 'administrador', auth.uid());

  insert into public.admin_audit_log (actor, action, org_id, details)
  values (auth.uid(), 'responsavel_trocado', p_org, json_build_object('nome', trim(p_name), 'email', lower(trim(p_email)))::jsonb);

  return v_token;
end;
$$;

revoke all on function public.admin_set_responsible(uuid, text, text) from public, anon;
grant execute on function public.admin_set_responsible(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Fotos e vídeos do cardápio — pasta pública "cardapio"
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cardapio', 'cardapio', true, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "cardapio enviar" on storage.objects;
create policy "cardapio enviar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cardapio' and (public.luma_can_write(public.luma_org_from_path(name)) or public.is_platform_admin()));

drop policy if exists "cardapio alterar" on storage.objects;
create policy "cardapio alterar" on storage.objects
  for update to authenticated
  using (bucket_id = 'cardapio' and (public.luma_can_write(public.luma_org_from_path(name)) or public.is_platform_admin()))
  with check (bucket_id = 'cardapio' and (public.luma_can_write(public.luma_org_from_path(name)) or public.is_platform_admin()));

drop policy if exists "cardapio excluir" on storage.objects;
create policy "cardapio excluir" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cardapio' and (public.luma_can_write(public.luma_org_from_path(name)) or public.is_platform_admin()));
