"use client";

import { useMemo, useState, type FormEvent } from "react";
import { LuCalendarPlus, LuCircleCheck, LuPause, LuPencil, LuPlay, LuPlus, LuRepeat, LuTrash2 } from "react-icons/lu";
import { addDays, endOfMonth, formatDate, isValidISO, relativeDays, diffDays, monthLabel } from "@/lib/dates";
import { CATEGORIES, FREQUENCY_LABEL, monthlyEquivalent, nextOccurrence, occurrencesInRange } from "@/lib/domain";
import { amountToInput, formatBRL, parseBRL } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Frequency, RecurringExpense } from "@/lib/types";
import { Badge, Button, cx, EmptyState, Field, IconButton, Input, Modal, PageHeader, Select, Textarea, useConfirm, useToast } from "../../ui";
import { useBillActions } from "../bills/BillActions";

interface Form {
  description: string;
  supplier: string;
  amount: string;
  category: string;
  dayOfMonth: string;
  frequency: Frequency;
  startDate: string;
  endDate: string;
  active: boolean;
  notes: string;
}

function RecurringForm({ initial, onClose }: { initial: Partial<RecurringExpense>; onClose: () => void }) {
  const { today, addRecurring, updateRecurring } = useStore();
  const toast = useToast();
  const [f, setF] = useState<Form>({
    description: initial.description ?? "",
    supplier: initial.supplier ?? "",
    amount: amountToInput(initial.amount),
    category: initial.category ?? "",
    dayOfMonth: String(initial.dayOfMonth ?? Number(today.slice(8, 10))),
    frequency: initial.frequency ?? "mensal",
    startDate: initial.startDate ?? today,
    endDate: initial.endDate ?? "",
    active: initial.active ?? true,
    notes: initial.notes ?? "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: typeof errors = {};
    const amount = parseBRL(f.amount);
    const day = Number(f.dayOfMonth);
    if (!f.description.trim()) err.description = "Informe a descrição.";
    if (amount === undefined || amount <= 0) err.amount = "Informe um valor maior que zero.";
    if (!f.category) err.category = "Escolha uma categoria.";
    if (!Number.isInteger(day) || day < 1 || day > 31) err.dayOfMonth = "Use um dia entre 1 e 31.";
    if (!isValidISO(f.startDate)) err.startDate = "Informe a data de início.";
    if (f.endDate && !isValidISO(f.endDate)) err.endDate = "Data inválida.";
    if (f.endDate && isValidISO(f.startDate) && f.endDate < f.startDate) err.endDate = "O término deve ser depois do início.";
    setErrors(err);
    if (Object.keys(err).length) return;
    const payload = {
      description: f.description.trim(),
      supplier: f.supplier.trim() || undefined,
      amount: amount!,
      category: f.category,
      dayOfMonth: day,
      frequency: f.frequency,
      startDate: f.startDate,
      endDate: f.endDate || undefined,
      active: f.active,
      notes: f.notes.trim() || undefined,
    };
    if (initial.id) {
      updateRecurring(initial.id, payload);
      toast("success", "Despesa recorrente atualizada.");
    } else {
      addRecurring(payload);
      toast("success", "Despesa recorrente cadastrada.");
    }
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial.id ? "Editar despesa recorrente" : "Nova despesa recorrente"}
      description="Os próximos vencimentos são calculados automaticamente."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="rec-form">
            {initial.id ? "Salvar alterações" : "Cadastrar despesa"}
          </Button>
        </>
      }
    >
      <form id="rec-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Descrição" htmlFor="r-desc" required error={errors.description} className="sm:col-span-2">
          <Input id="r-desc" value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Ex.: Aluguel do escritório" invalid={!!errors.description} />
        </Field>
        <Field label="Fornecedor" htmlFor="r-sup">
          <Input id="r-sup" value={f.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="Opcional" />
        </Field>
        <Field label="Valor (R$)" htmlFor="r-amount" required error={errors.amount}>
          <Input id="r-amount" value={f.amount} inputMode="decimal" className="tabular" onChange={(e) => set("amount", e.target.value)} onBlur={() => { const v = parseBRL(f.amount); if (v !== undefined) set("amount", amountToInput(v)); }} placeholder="0,00" invalid={!!errors.amount} />
        </Field>
        <Field label="Categoria" htmlFor="r-cat" required error={errors.category}>
          <Select id="r-cat" value={f.category} onChange={(e) => set("category", e.target.value)} invalid={!!errors.category}>
            <option value="">Selecione…</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Frequência" htmlFor="r-freq" required>
          <Select id="r-freq" value={f.frequency} onChange={(e) => set("frequency", e.target.value as Frequency)}>
            {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((k) => (
              <option key={k} value={k}>
                {FREQUENCY_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Dia do vencimento" htmlFor="r-day" required error={errors.dayOfMonth} hint="Em meses mais curtos, vence no último dia.">
          <Input id="r-day" type="number" min={1} max={31} value={f.dayOfMonth} onChange={(e) => set("dayOfMonth", e.target.value)} invalid={!!errors.dayOfMonth} />
        </Field>
        <Field label="Data de início" htmlFor="r-start" required error={errors.startDate}>
          <Input id="r-start" type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} invalid={!!errors.startDate} />
        </Field>
        <Field label="Data de término" htmlFor="r-end" error={errors.endDate} hint="Opcional">
          <Input id="r-end" type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} invalid={!!errors.endDate} />
        </Field>
        <Field label="Observações" htmlFor="r-notes" className="sm:col-span-2">
          <Textarea id="r-notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <label className="flex items-center gap-2.5 text-sm font-semibold sm:col-span-2">
          <input type="checkbox" className="size-4 accent-[#111111]" checked={f.active} onChange={(e) => set("active", e.target.checked)} />
          Despesa ativa
        </label>
      </form>
    </Modal>
  );
}

export function RecurringPage() {
  const { data, today, updateRecurring, deleteRecurring } = useStore();
  const actions = useBillActions();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState<Partial<RecurringExpense> | null>(null);

  const upcoming = useMemo(() => occurrencesInRange(data.recurring, data.bills, addDays(today, -31), addDays(today, 60)).filter((o) => !o.bill || o.date >= today), [data, today]);
  const pendingThisMonth = upcoming.filter((o) => !o.bill && o.date <= endOfMonth(today));
  const active = data.recurring.filter((r) => r.active);
  const monthlyTotal = active.reduce((a, r) => a + monthlyEquivalent(r), 0);

  const remove = async (r: RecurringExpense) => {
    const launched = data.bills.filter((b) => b.recurringId === r.id).length;
    const ok = await confirm({
      title: "Excluir despesa recorrente?",
      message: (
        <>
          <strong>{r.description}</strong> deixará de gerar vencimentos.
          {launched > 0 && ` As ${launched} contas já lançadas a partir dela serão mantidas.`}
        </>
      ),
      confirmLabel: "Excluir despesa",
      danger: true,
    });
    if (ok) {
      deleteRecurring(r.id);
      toast("success", "Despesa recorrente excluída.");
    }
  };

  const launchAll = () => {
    pendingThisMonth.forEach((o) => actions.launchOccurrence(o));
  };

  return (
    <div>
      <PageHeader
        title="Despesas recorrentes"
        description="Aluguel, internet, softwares e outras despesas que se repetem. Lance cada vencimento como conta a pagar quando quiser — sem duplicar."
        actions={
          <Button icon={<LuPlus className="size-4" />} onClick={() => setEditing({})}>
            Nova despesa recorrente
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="card p-4">
          <p className="text-[13px] font-semibold text-muted">Despesas ativas</p>
          <p className="font-display text-2xl font-semibold">{active.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-[13px] font-semibold text-muted">Custo mensal equivalente</p>
          <p className="font-display text-2xl font-semibold tabular">{formatBRL(monthlyTotal)}</p>
        </div>
        <div className="card col-span-2 p-4 sm:col-span-1">
          <p className="text-[13px] font-semibold text-muted">A lançar neste mês</p>
          <p className="font-display text-2xl font-semibold">{pendingThisMonth.length}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <section className="card overflow-hidden">
          <h2 className="px-5 pb-3 pt-5 font-display text-base font-semibold">Cadastradas</h2>
          {data.recurring.length === 0 ? (
            <EmptyState icon={<LuRepeat className="size-6" />} title="Nenhuma despesa recorrente" action={<Button onClick={() => setEditing({})}>Cadastrar despesa</Button>}>
              Cadastre despesas fixas para prever os próximos vencimentos.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {[...data.recurring]
                .sort((a, b) => Number(b.active) - Number(a.active) || a.description.localeCompare(b.description))
                .map((r) => {
                  const next = r.active ? nextOccurrence(r, today, data.bills) : undefined;
                  return (
                    <li key={r.id} className={cx("flex flex-wrap items-center gap-3 px-5 py-3.5", !r.active && "opacity-60")}>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                          {r.description}
                          <Badge tone={r.active ? "info" : "neutral"}>{r.active ? FREQUENCY_LABEL[r.frequency] : "Inativa"}</Badge>
                        </p>
                        <p className="text-xs text-muted">
                          {r.category} — todo dia {r.dayOfMonth}
                          {r.endDate ? `, até ${formatDate(r.endDate)}` : ""}
                          {next ? `. Próximo: ${formatDate(next)}` : ""}
                        </p>
                      </div>
                      <span className="font-semibold tabular">{formatBRL(r.amount)}</span>
                      <div className="flex gap-0.5">
                        <IconButton label={r.active ? "Desativar" : "Ativar"} onClick={() => { updateRecurring(r.id, { active: !r.active }); toast("info", r.active ? "Despesa desativada." : "Despesa ativada."); }}>
                          {r.active ? <LuPause className="size-4" /> : <LuPlay className="size-4" />}
                        </IconButton>
                        <IconButton label="Editar" onClick={() => setEditing(r)}>
                          <LuPencil className="size-4" />
                        </IconButton>
                        <IconButton label="Excluir" onClick={() => remove(r)} className="hover:!bg-overdue-soft hover:!text-overdue">
                          <LuTrash2 className="size-4" />
                        </IconButton>
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-5 pb-3 pt-5">
            <h2 className="font-display text-base font-semibold">Próximos vencimentos</h2>
            {pendingThisMonth.length > 0 && (
              <Button size="sm" variant="soft" icon={<LuCalendarPlus className="size-4" />} onClick={launchAll}>
                Lançar os {pendingThisMonth.length} deste mês
              </Button>
            )}
          </div>
          {upcoming.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-muted">Nenhum vencimento previsto nos próximos 60 dias.</p>
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.slice(0, 14).map((o) => {
                const days = diffDays(today, o.date);
                return (
                  <li key={`${o.recurring.id}${o.date}`} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-11 shrink-0 text-center">
                      <p className="font-display text-lg font-semibold leading-none">{o.date.slice(8, 10)}</p>
                      <p className="text-[11px] text-muted">{monthLabel(o.date.slice(0, 7)).split("/")[0]}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{o.recurring.description}</p>
                      <p className={cx("text-xs", days < 0 ? "text-overdue" : "text-muted")}>
                        {formatBRL(o.recurring.amount)} — {relativeDays(days)}
                      </p>
                    </div>
                    {o.bill ? (
                      <Badge tone="paid">
                        <LuCircleCheck className="size-3" /> Lançada
                      </Badge>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => actions.launchOccurrence(o)}>
                        Lançar
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="border-t border-line bg-paper/60 px-5 py-3 text-xs text-muted">
            Cada vencimento só pode ser lançado uma vez. Ao lançar, ele vira uma conta a pagar com status, alertas e relatórios.
          </p>
        </section>
      </div>

      {editing && <RecurringForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
