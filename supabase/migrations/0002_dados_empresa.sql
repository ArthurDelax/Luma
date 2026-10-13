-- =====================================================================
-- Luma — dados de cada empresa (contas, recorrentes, documentos, alertas)
-- e anexos em PDF.
--
-- Como aplicar: Supabase → SQL Editor → New query → cole este arquivo
-- inteiro → Run. Rode DEPOIS do 0001_plataforma.sql. Pode ser executado
-- mais de uma vez (é idempotente).
--
-- Isolamento entre empresas (verificado pelo próprio banco, RLS):
--  * Só lê quem é usuário ativo da empresa (empresa ativa, inadimplente
--    ou suspensa; cancelada = sem acesso).
--  * Só altera quem tem papel "administrador" ou "financeiro" e a empresa
--    está ativa ou inadimplente (suspensa = somente leitura).
--  * O dono da plataforma NÃO lê os dados financeiros dos clientes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------

create or replace function public.luma_can_read(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_org is not null and exists (
    select 1
      from public.memberships m
      join public.organizations o on o.id = m.org_id
     where m.org_id = p_org
       and m.user_id = auth.uid()
       and m.status = 'ativo'
       and o.status in ('ativa', 'inadimplente', 'suspensa')
  );
$$;

create or replace function public.luma_can_write(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_org is not null and exists (
    select 1
      from public.memberships m
      join public.organizations o on o.id = m.org_id
     where m.org_id = p_org
       and m.user_id = auth.uid()
       and m.status = 'ativo'
       and m.role in ('administrador', 'financeiro')
       and o.status in ('ativa', 'inadimplente')
  );
$$;

-- Extrai a empresa do caminho do arquivo ("<org_id>/<arquivo>"); nulo se inválido.
create or replace function public.luma_org_from_path(p_name text)
returns uuid
language sql
immutable
as $$
  select case
           when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then split_part(p_name, '/', 1)::uuid
         end;
$$;

-- ---------------------------------------------------------------------
-- Registros da empresa
-- ---------------------------------------------------------------------

create table if not exists public.org_records (
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('bill', 'recurring', 'document', 'alert_read')),
  id text not null check (char_length(id) between 1 and 80),
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 200000),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (org_id, kind, id)
);

create index if not exists org_records_org_idx on public.org_records (org_id, updated_at desc);

create or replace function public.luma_touch_record()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists org_records_touch on public.org_records;
create trigger org_records_touch before insert or update on public.org_records
  for each row execute function public.luma_touch_record();

alter table public.org_records enable row level security;

drop policy if exists "empresa lê seus registros" on public.org_records;
create policy "empresa lê seus registros" on public.org_records
  for select to authenticated
  using (public.luma_can_read(org_id));

drop policy if exists "empresa cria registros" on public.org_records;
create policy "empresa cria registros" on public.org_records
  for insert to authenticated
  with check (public.luma_can_write(org_id) or (kind = 'alert_read' and public.luma_can_read(org_id)));

drop policy if exists "empresa altera registros" on public.org_records;
create policy "empresa altera registros" on public.org_records
  for update to authenticated
  using (public.luma_can_write(org_id) or (kind = 'alert_read' and public.luma_can_read(org_id)))
  with check (public.luma_can_write(org_id) or (kind = 'alert_read' and public.luma_can_read(org_id)));

drop policy if exists "empresa exclui registros" on public.org_records;
create policy "empresa exclui registros" on public.org_records
  for delete to authenticated
  using (public.luma_can_write(org_id));

revoke all on public.org_records from anon;
grant select, insert, update, delete on public.org_records to authenticated;

grant execute on function public.luma_can_read(uuid) to authenticated;
grant execute on function public.luma_can_write(uuid) to authenticated;
revoke all on function public.luma_can_read(uuid) from anon;
revoke all on function public.luma_can_write(uuid) from anon;

-- ---------------------------------------------------------------------
-- Anexos (PDF) — bucket privado; caminho "<org_id>/<arquivo>"
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anexos', 'anexos', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "luma anexos ler" on storage.objects;
create policy "luma anexos ler" on storage.objects
  for select to authenticated
  using (bucket_id = 'anexos' and public.luma_can_read(public.luma_org_from_path(name)));

drop policy if exists "luma anexos enviar" on storage.objects;
create policy "luma anexos enviar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'anexos' and public.luma_can_write(public.luma_org_from_path(name)));

drop policy if exists "luma anexos alterar" on storage.objects;
create policy "luma anexos alterar" on storage.objects
  for update to authenticated
  using (bucket_id = 'anexos' and public.luma_can_write(public.luma_org_from_path(name)))
  with check (bucket_id = 'anexos' and public.luma_can_write(public.luma_org_from_path(name)));

drop policy if exists "luma anexos excluir" on storage.objects;
create policy "luma anexos excluir" on storage.objects
  for delete to authenticated
  using (bucket_id = 'anexos' and public.luma_can_write(public.luma_org_from_path(name)));
