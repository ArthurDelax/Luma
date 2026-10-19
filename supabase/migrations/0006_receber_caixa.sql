-- =====================================================================
-- Luma — contas a receber e saldo em caixa
--
-- Ficam em org_records, com as mesmas regras de acesso das contas a pagar:
--   kind = 'receivable'  → uma conta a receber por registro
--   kind = 'setting'     → configurações da empresa (id 'cash' = saldo e chave Pix)
-- Idempotente.
-- =====================================================================

alter table public.org_records drop constraint if exists org_records_kind_check;
alter table public.org_records
  add constraint org_records_kind_check
  check (kind in ('bill', 'recurring', 'document', 'category', 'receivable', 'setting', 'alert_read'));
