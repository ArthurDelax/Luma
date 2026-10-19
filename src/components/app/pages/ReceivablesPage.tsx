"use client";

import { useMemo, useState, type FormEvent } from "react";
import { LuCircleCheck, LuFileUp, LuInbox, LuMessageCircle, LuPencil, LuPlus, LuRotateCcw, LuTrash2 } from "react-icons/lu";
import { receivableStatus, type ReceivableStatus } from "@/lib/cashflow";
import { chargeLink } from "@/lib/charge";
import { addDays, addMonthsClamped, formatDate, isValidISO, relativeDays, diffDays, startOfMonth } from "@/lib/dates";
import { amountToInput, formatBRL, parseBRL } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Receivable } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace";
import { Badge, Button, cx, EmptyState, Field, IconButton, Input, Modal, ModalCloseButton, PageHeader, Segmented, Select, Textarea, useConfirm, useToast, type Tone } from "../../ui";
import { ImportSheet } from "../imports/ImportSheet";

export const RECEIVABLE_CATEGORIES = ["Vendas", "Serviços", "Mensalidades de clientes", "Aluguel recebido", "Outras entradas"];

const STATUS: Record<ReceivableStatus, [string, Tone]> = {
  a_receber: ["A receber", "info"],
  atrasado: ["Atrasado", "overdue"],
  recebido: ["Recebido", "paid"],
};

type Filter = "abertos" | "atrasados" | "recebidos" | "todos";

/** Nome da empresa para assinar as cobranças. */
export function useCompanyName(): string | undefined {
  const ws = useWorkspace();
  return ws.mode === "cloud" ? ws.orgName : "Empresa Demonstração";
}

export function ReceivablesPage() {
  const { data, today, markReceived, reopenReceivable, deleteReceivable, requireWrite } = useStore();
  const toast = useToast();
  const confirm = useConfirm();
  const company = useCompanyName();
  const [filter, setFilter] = useState<Filter>("abertos");
  const [editing, setEditing] = useState<Partial<Receivable> | null>(null);
  const [importing, setImporting] = useState(false);
  const list = data.receivables ?? [];

  const rows = useMemo(
    () =>
      list
        .map((r) => ({ r, s: receivableStatus(r, today) }))
        .filter(({ s }) => (filter === "todos" ? true : filter === "abertos" ? s !== "recebido" : filter === "atrasados" ? s === "atrasado" : s === "recebido"))
        .sort((a, b) => (filter === "recebidos" ? (b.r.receivedAt ?? "").localeCompare(a.r.receivedAt ?? "") : a.r.dueDate.localeCompare(b.r.dueDate))),
    [list, today, filter],
  );

  const sum = (pred: (r: Receivable) => boolean) => list.filter(pred).reduce((s, r) => s + r.amount, 0);
  const next30 = sum((r) => !r.receivedAt && r.dueDate >= today && r.dueDate <= addDays(today, 30));
  const late = sum((r) => !r.receivedAt && r.dueDate < today);
  const lateCount = list.filter((r) => !r.receivedAt && r.dueDate < today).length;
  const month0 = startOfMonth(today);
  const receivedMonth = sum((r) => !!r.receivedAt && r.receivedAt >= month0);

  const remove = async (r: Receivable) => {
    if (!requireWrite()) return;
    const ok = await confirm({ title: "Excluir recebimento?", message: `"${r.description}" de ${r.customer} (${formatBRL(r.amount)}) será excluído.`, confirmLabel: "Excluir", danger: true });
    if (ok) {
      deleteReceivable(r.id);
      toast("success", "Recebimento excluído.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Contas a receber"
        description="O que seus clientes devem pagar. Entra na previsão do fluxo de caixa."
        actions={
          <>
            <Button variant="secondary" icon={<LuFileUp className="size-4" />} onClick={() => requireWrite() && setImporting(true)}>
              Importar planilha
            </Button>
            <Button icon={<LuPlus className="size-4" />} onClick={() => requireWrite() && setEditing({})}>
              Novo recebimento
            </Button>
          </>
        }
      />

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <Stat label="A receber em 30 dias" value={formatBRL(next30)} tone="ink" />
        <Stat label={`Em atraso${lateCount ? ` (${lateCount})` : ""}`} value={formatBRL(late)} tone={late > 0 ? "overdue" : "ink"} />
        <Stat label="Recebido este mês" value={formatBRL(receivedMonth)} tone="paid" />
      </section>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto border-b border-line p-3 [&>*]:min-w-max">
          <Segmented
            label="Filtrar recebimentos"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "abertos", label: "Em aberto" },
              { value: "atrasados", label: "Atrasados", count: lateCount },
              { value: "recebidos", label: "Recebidos" },
              { value: "todos", label: "Todos" },
            ]}
          />
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={<LuInbox className="size-6" />}
            title={list.length ? "Nada por aqui" : "Nenhum recebimento cadastrado"}
            action={!list.length && <Button onClick={() => requireWrite() && setEditing({})}>Cadastrar primeiro recebimento</Button>}
          >
            {list.length ? "Mude o filtro para ver outros recebimentos." : "Cadastre as vendas e serviços a receber para a Luma prever o seu caixa."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map(({ r, s }) => {
              const [label, tone] = STATUS[s];
              const days = diffDays(today, r.dueDate);
              return (
                <li key={r.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
                  <button type="button" onClick={() => requireWrite() && setEditing(r)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-semibold">{r.customer}</p>
                    <p className="truncate text-xs text-muted">{r.description}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                      <Badge tone={tone} dot>
                        {label}
                      </Badge>
                      <span className="text-muted tabular">
                        {s === "recebido" ? `recebido em ${formatDate(r.receivedAt)}` : `vence ${formatDate(r.dueDate)} · ${relativeDays(days)}`}
                      </span>
                    </p>
                  </button>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <span className="font-display text-lg font-semibold tabular">{formatBRL(r.amount)}</span>
                    <div className="flex items-center gap-0.5">
                      {s !== "recebido" && (
                        <a
                          href={chargeLink(r, today, company, data.cash?.pixKey)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cx("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-transform active:scale-95", s === "atrasado" ? "bg-[#25d366]/15 text-[#128c4a]" : "text-muted hover:bg-sky-100 hover:text-ink")}
                          title="Abrir o WhatsApp com a cobrança pronta"
                        >
                          <LuMessageCircle className="size-4" /> Cobrar
                        </a>
                      )}
                      {s === "recebido" ? (
                        <IconButton label="Marcar como não recebido" onClick={() => reopenReceivable(r.id)}>
                          <LuRotateCcw className="size-4" />
                        </IconButton>
                      ) : (
                        <IconButton label="Marcar como recebido" onClick={() => { markReceived(r.id); toast("success", "Recebimento registrado."); }} className="hover:!bg-paid-soft hover:!text-paid">
                          <LuCircleCheck className="size-4" />
                        </IconButton>
                      )}
                      <IconButton label="Editar" onClick={() => requireWrite() && setEditing(r)}>
                        <LuPencil className="size-4" />
                      </IconButton>
                      <IconButton label="Excluir" onClick={() => remove(r)} className="hover:!bg-overdue-soft hover:!text-overdue">
                        <LuTrash2 className="size-4" />
                      </IconButton>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {!data.cash?.pixKey && list.length > 0 && (
        <p className="mt-3 text-xs text-muted">Dica: cadastre a chave Pix da empresa em Fluxo de caixa para ela ir junto nas mensagens de cobrança.</p>
      )}

      <ReceivableForm initial={editing} onClose={() => setEditing(null)} />
      <ImportSheet open={importing} onClose={() => setImporting(false)} target="receber" />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "ink" | "overdue" | "paid" }) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <p className={cx("mt-2 font-display text-[1.7rem] font-semibold leading-none tracking-[-0.02em] tabular", tone === "overdue" ? "text-overdue" : tone === "paid" ? "text-paid" : "text-ink")}>{value}</p>
    </div>
  );
}

interface Form {
  customer: string;
  description: string;
  amount: string;
  dueDate: string;
  category: string;
  customerPhone: string;
  customerDoc: string;
  notes: string;
  repeat: string;
  received: boolean;
  receivedAt: string;
}

function toForm(r: Partial<Receivable>, today: string): Form {
  return {
    customer: r.customer ?? "",
    description: r.description ?? "",
    amount: amountToInput(r.amount),
    dueDate: r.dueDate ?? today,
    category: r.category ?? "",
    customerPhone: r.customerPhone ?? "",
    customerDoc: r.customerDoc ?? "",
    notes: r.notes ?? "",
    repeat: "1",
    received: !!r.receivedAt,
    receivedAt: r.receivedAt ?? today,
  };
}

/** Cadastro/edição de recebimento. `initial = null` fecha a janela (com animação). */
function ReceivableForm({ initial, onClose }: { initial: Partial<Receivable> | null; onClose: () => void }) {
  const { today, addReceivable, updateReceivable, requireWrite } = useStore();
  const toast = useToast();
  const [f, setF] = useState<Form>(() => toForm(initial ?? {}, today));
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [lastKey, setLastKey] = useState<unknown>(null);
  // reabre com os dados certos sempre que um novo item for aberto
  if (initial && initial !== lastKey) {
    setLastKey(initial);
    setF(toForm(initial, today));
    setErrors({});
  }
  const editing = !!initial?.id;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!requireWrite()) return;
    const err: typeof errors = {};
    const amount = parseBRL(f.amount);
    const repeat = Number(f.repeat);
    if (!f.customer.trim()) err.customer = "Informe o cliente.";
    if (!f.description.trim()) err.description = "Informe a descrição.";
    if (amount === undefined || amount <= 0) err.amount = "Informe um valor maior que zero.";
    if (!isValidISO(f.dueDate)) err.dueDate = "Informe o vencimento.";
    if (!editing && (!Number.isInteger(repeat) || repeat < 1 || repeat > 36)) err.repeat = "Entre 1 e 36.";
    if (f.received && !isValidISO(f.receivedAt)) err.receivedAt = "Informe a data.";
    setErrors(err);
    if (Object.keys(err).length) return;
    const base = {
      customer: f.customer.trim(),
      description: f.description.trim(),
      amount: amount!,
      category: f.category || undefined,
      customerPhone: f.customerPhone.replace(/\D/g, "") || undefined,
      customerDoc: f.customerDoc.trim() || undefined,
      notes: f.notes.trim() || undefined,
      receivedAt: f.received ? f.receivedAt : undefined,
    };
    if (editing) {
      updateReceivable(initial!.id!, { ...base, dueDate: f.dueDate });
      toast("success", "Recebimento atualizado.");
    } else {
      for (let i = 0; i < repeat; i++) {
        const due = i === 0 ? f.dueDate : addMonthsClamped(f.dueDate, i, Number(f.dueDate.slice(8, 10)));
        addReceivable({ ...base, description: repeat > 1 ? `${base.description} (${i + 1}/${repeat})` : base.description, dueDate: due, receivedAt: i === 0 ? base.receivedAt : undefined, source: "manual" });
      }
      toast("success", repeat > 1 ? `${repeat} recebimentos cadastrados.` : "Recebimento cadastrado.");
    }
    onClose();
  };

  return (
    <Modal
      open={!!initial}
      onClose={onClose}
      title={editing ? "Editar recebimento" : "Novo recebimento"}
      description="Valores que seus clientes vão pagar. Entram na previsão do caixa."
      footer={
        <>
          <ModalCloseButton>Cancelar</ModalCloseButton>
          <Button type="submit" form="rcb-form">
            {editing ? "Salvar alterações" : "Cadastrar"}
          </Button>
        </>
      }
    >
      <form id="rcb-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente" htmlFor="rc-cust" required error={errors.customer}>
          <Input id="rc-cust" value={f.customer} onChange={(e) => set("customer", e.target.value)} placeholder="Nome do cliente" invalid={!!errors.customer} maxLength={120} data-autofocus />
        </Field>
        <Field label="WhatsApp do cliente" htmlFor="rc-phone" hint="Para cobrar com um toque">
          <Input id="rc-phone" value={f.customerPhone} inputMode="tel" onChange={(e) => set("customerPhone", e.target.value)} placeholder="(62) 99999-0000" />
        </Field>
        <Field label="Descrição" htmlFor="rc-desc" required error={errors.description} className="sm:col-span-2">
          <Input id="rc-desc" value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Ex.: Serviço de manutenção de outubro" invalid={!!errors.description} maxLength={140} />
        </Field>
        <Field label="Valor (R$)" htmlFor="rc-amount" required error={errors.amount}>
          <Input id="rc-amount" value={f.amount} inputMode="decimal" className="tabular" onChange={(e) => set("amount", e.target.value)} onBlur={() => { const v = parseBRL(f.amount); if (v !== undefined) set("amount", amountToInput(v)); }} placeholder="0,00" invalid={!!errors.amount} />
        </Field>
        <Field label="Vencimento" htmlFor="rc-due" required error={errors.dueDate}>
          <Input id="rc-due" type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} invalid={!!errors.dueDate} />
        </Field>
        <Field label="Tipo de entrada" htmlFor="rc-cat">
          <Select id="rc-cat" value={f.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">Selecione…</option>
            {RECEIVABLE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        {!editing ? (
          <Field label="Repetir por quantos meses" htmlFor="rc-rep" error={errors.repeat} hint="Parcelas ou mensalidades">
            <Input id="rc-rep" type="number" min={1} max={36} value={f.repeat} onChange={(e) => set("repeat", e.target.value)} invalid={!!errors.repeat} />
          </Field>
        ) : (
          <Field label="CPF ou CNPJ do cliente" htmlFor="rc-doc" hint="Opcional">
            <Input id="rc-doc" value={f.customerDoc} onChange={(e) => set("customerDoc", e.target.value)} />
          </Field>
        )}
        <Field label="Observações" htmlFor="rc-notes" className="sm:col-span-2">
          <Textarea id="rc-notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <label className="flex items-center gap-2.5 text-sm font-semibold sm:col-span-2">
          <input type="checkbox" checked={f.received} onChange={(e) => set("received", e.target.checked)} className="size-4 accent-[#111]" />
          Já recebido
        </label>
        {f.received && (
          <Field label="Recebido em" htmlFor="rc-recv" error={errors.receivedAt}>
            <Input id="rc-recv" type="date" value={f.receivedAt} max={today} onChange={(e) => set("receivedAt", e.target.value)} invalid={!!errors.receivedAt} />
          </Field>
        )}
      </form>
    </Modal>
  );
}
