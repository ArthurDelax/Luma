-- =====================================================================
-- Luma — categorias próprias de cada empresa
--
-- Como aplicar: Supabase → SQL Editor → New query → cole este arquivo
-- inteiro → Run. Rode DEPOIS do 0002_dados_empresa.sql. Pode ser
-- executado mais de uma vez (é idempotente).
--
-- As categorias ficam em org_records (kind = 'category'), com as mesmas
-- regras de acesso das contas: só lê quem é da empresa e só altera
-- administrador ou financeiro com a empresa ativa ou inadimplente.
-- =====================================================================

alter table public.org_records drop constraint if exists org_records_kind_check;
alter table public.org_records
  add constraint org_records_kind_check
  check (kind in ('bill', 'recurring', 'document', 'category', 'alert_read'));
