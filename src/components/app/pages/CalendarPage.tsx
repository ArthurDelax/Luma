"use client";

import { useMemo, useState } from "react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { addMonthsClamped, endOfMonth, formatDate, formatDateLong, monthLabel, parseISO, startOfMonth, toISO } from "@/lib/dates";
import { billStatus, docSituation, FREQUENCY_LABEL, occurrencesInRange, type Occurrence } from "@/lib/domain";
import { formatBRL } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { BusinessDocument } from "@/lib/types";
import { Button, cx, IconButton, Modal, PageHeader } from "../../ui";
import { useBillActions } from "../bills/BillActions";
import { navigate } from "../routing";

export type CalKind = "conta" | "vencida" | "paga" | "recorrente" | "contrato" | "documento";

export interface CalEvent {
  id: string;
  date: string;
  kind: CalKind;
  title: string;
  amount?: number;
  billId?: string;
  occurrence?: Occurrence;
  doc?: BusinessDocument;
}

export const CAL_STYLE: Record<CalKind, { label: string; dot: string; chip: string }> = {
  vencida: { label: "Conta vencida", dot: "bg-overdue", chip: "bg-overdue-soft text-overdue" },
  conta: { label: "Conta a pagar", dot: "bg-sky-500", chip: "bg-sky-100 text-navy-700" },
  paga: { label: "Conta paga", dot: "bg-paid", chip: "bg-paid-soft text-paid" },
  recorrente: { label: "Recorrente prevista", dot: "bg-sky-300", chip: "bg-white text-navy-600 ring-1 ring-inset ring-sky-200 border-dashed" },
  contrato: { label: "Contrato", dot: "bg-contract", chip: "bg-contract-soft text-contract" },
  documento: { label: "Documento", dot: "bg-doc", chip: "bg-doc-soft text-doc" },
};

export function useCalendarEvents(from: string, to: string): CalEvent[] {
  const { data, today } = useStore();
  return useMemo(() => {
    const ev: CalEvent[] = [];
    for (const b of data.bills) {
      if (b.dueDate < from || b.dueDate > to) continue;
      const s = billStatus(b, today);
      ev.push({ id: b.id, date: b.dueDate, kind: s === "pago" ? "paga" : s === "vencido" ? "vencida" : "conta", title: b.description, amount: b.amount, billId: b.id });
    }
    for (const o of occurrencesInRange(data.recurring, data.bills, from, to)) {
      if (o.bill) continue;
      ev.push({ id: `occ${o.recurring.id}${o.date}`, date: o.date, kind: "recorrente", title: o.recurring.description, amount: o.recurring.amount, occurrence: o });
    }
    for (const d of data.documents) {
      if (d.endDate < from || d.endDate > to) continue;
      ev.push({ id: d.id, date: d.endDate, kind: d.kind, title: d.name, doc: d });
    }
    const order: Record<CalKind, number> = { vencida: 0, conta: 1, recorrente: 2, contrato: 3, documento: 4, paga: 5 };
    return ev.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind]);
  }, [data, today, from, to]);
}

function monthGrid(month: string): string[] {
  const first = parseISO(startOfMonth(month));
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toISO(d);
  });
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function EventDetail({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const { today } = useStore();
  const actions = useBillActions();
  const o = event.occurrence;
  const d = event.doc;
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={event.title}
      description={`${CAL_STYLE[event.kind].label} — ${formatDate(event.date)}`}
      footer={
        o ? (
          <>
            <Button variant="secondary" onClick={() => { onClose(); navigate("recorrentes"); }}>
              Ver recorrentes
            </Button>
            <Button onClick={() => { actions.launchOccurrence(o); onClose(); }}>Lançar como conta</Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => { onClose(); navigate("documentos"); }}>
            Abrir contratos e documentos
          </Button>
        )
      }
    >
      {o && (
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Valor</dt><dd className="font-semibold tabular">{formatBRL(o.recurring.amount)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Frequência</dt><dd>{FREQUENCY_LABEL[o.recurring.frequency]}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Categoria</dt><dd>{o.recurring.category}</dd></div>
          <p className="pt-2 text-xs text-muted">Vencimento previsto, ainda não lançado como conta a pagar.</p>
        </dl>
      )}
      {d && (
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-muted">Tipo</dt><dd className="text-right">{d.type}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted">Empresa ou responsável</dt><dd className="text-right">{d.party}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted">Situação</dt><dd className="text-right">{(() => { const s = docSituation(d, today); return s.situation === "vencido" ? "Vencido" : s.situation === "encerrado" ? "Encerrado" : s.days === 0 ? "Vence hoje" : `Vence em ${s.days} dias`; })()}</dd></div>
          {d.notes && <p className="pt-2 text-xs text-slate-600">{d.notes}</p>}
        </dl>
      )}
    </Modal>
  );
}

export function CalendarPage() {
  const { today } = useStore();
  const actions = useBillActions();
  const [month, setMonth] = useState(startOfMonth(today));
  const [selected, setSelected] = useState<string | null>(today);
  const [detail, setDetail] = useState<CalEvent | null>(null);
  const days = useMemo(() => monthGrid(month), [month]);
  const events = useCalendarEvents(days[0], days[41]);
  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [events]);
  const monthEvents = events.filter((e) => e.date >= month && e.date <= endOfMonth(month));
  const monthTotal = monthEvents.filter((e) => e.kind !== "contrato" && e.kind !== "documento").reduce((a, e) => a + (e.amount ?? 0), 0);

  const openEvent = (e: CalEvent) => (e.billId ? actions.viewBill(e.billId) : setDetail(e));
  const selectedEvents = selected ? byDay.get(selected) ?? [] : [];

  return (
    <div>
      <PageHeader title="Calendário" description="Contas, despesas recorrentes, contratos e documentos em um só lugar." />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
            <IconButton label="Mês anterior" onClick={() => setMonth(addMonthsClamped(month, -1, 1))}>
              <LuChevronLeft className="size-5" />
            </IconButton>
            <h2 className="min-w-40 text-center font-display text-lg font-semibold capitalize">{monthLabel(month.slice(0, 7), false)}</h2>
            <IconButton label="Próximo mês" onClick={() => setMonth(addMonthsClamped(month, 1, 1))}>
              <LuChevronRight className="size-5" />
            </IconButton>
            <Button variant="ghost" size="sm" onClick={() => { setMonth(startOfMonth(today)); setSelected(today); }}>
              Hoje
            </Button>
            <span className="ml-auto text-sm text-muted">
              Total do mês: <strong className="text-ink tabular">{formatBRL(monthTotal)}</strong>
            </span>
          </div>
          <div className="grid grid-cols-7 border-b border-line bg-paper/60 text-center text-xs font-semibold text-muted">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-2">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const inMonth = d.slice(0, 7) === month.slice(0, 7);
              const list = byDay.get(d) ?? [];
              const isToday = d === today;
              return (
                <div
                  key={d}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(d)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelected(d)}
                  aria-label={`${formatDateLong(d)}: ${list.length} eventos`}
                  className={cx(
                    "relative min-h-16 border-line p-1 text-left transition-colors sm:min-h-28 sm:p-1.5",
                    i % 7 !== 6 && "border-r",
                    i < 35 && "border-b",
                    !inMonth && "bg-paper/50",
                    selected === d ? "bg-sky-50 ring-2 ring-inset ring-sky-300" : "hover:bg-sky-50/50",
                  )}
                >
                  <span className={cx("mb-1 grid size-6 place-items-center rounded-full text-xs font-semibold tabular", isToday ? "bg-ink text-white" : inMonth ? "text-ink" : "text-slate-400")}>{parseISO(d).getDate()}</span>
                  {/* celular: pontos */}
                  <div className="flex flex-wrap gap-0.5 sm:hidden">
                    {list.slice(0, 4).map((e) => (
                      <span key={e.id} className={cx("size-1.5 rounded-full", CAL_STYLE[e.kind].dot)} />
                    ))}
                  </div>
                  {/* desktop: chips */}
                  <div className="hidden space-y-0.5 sm:block">
                    {list.slice(0, 3).map((e) => (
                      <button
                        key={e.id}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          openEvent(e);
                        }}
                        className={cx("block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-semibold hover:brightness-95", CAL_STYLE[e.kind].chip)}
                        title={`${e.title}${e.amount ? ` — ${formatBRL(e.amount)}` : ""}`}
                      >
                        {e.title}
                      </button>
                    ))}
                    {list.length > 3 && <span className="block px-1.5 text-[11px] font-semibold text-muted">+{list.length - 3} mais</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-3 text-xs text-muted sm:px-5">
            {(Object.keys(CAL_STYLE) as CalKind[]).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={cx("size-2 rounded-full", CAL_STYLE[k].dot)} />
                {CAL_STYLE[k].label}
              </span>
            ))}
          </div>
        </section>

        <aside className="card h-fit overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-base font-semibold first-letter:uppercase">{selected ? formatDateLong(selected) : "Selecione um dia"}</h2>
            <p className="text-xs text-muted">{selectedEvents.length ? `${selectedEvents.length} ${selectedEvents.length === 1 ? "evento" : "eventos"}` : "Nenhum evento neste dia"}</p>
          </div>
          <ul className="divide-y divide-line">
            {selectedEvents.map((e) => (
              <li key={e.id}>
                <button onClick={() => openEvent(e)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-sky-50/60">
                  <span className={cx("size-2.5 shrink-0 rounded-full", CAL_STYLE[e.kind].dot)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{e.title}</span>
                    <span className="text-xs text-muted">{CAL_STYLE[e.kind].label}</span>
                  </span>
                  {e.amount !== undefined && <span className="text-sm font-semibold tabular">{formatBRL(e.amount)}</span>}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {detail && <EventDetail event={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

/** Calendário compacto para o painel. */
export function MiniCalendar() {
  const { today } = useStore();
  const actions = useBillActions();
  const [detail, setDetail] = useState<CalEvent | null>(null);
  const month = startOfMonth(today);
  const days = useMemo(() => monthGrid(month), [month]);
  const events = useCalendarEvents(days[0], days[41]);
  const [selected, setSelected] = useState<string>(today);
  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [events]);
  const list = byDay.get(selected) ?? [];
  return (
    <div>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-muted">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1">
            {w[0]}
          </span>
        ))}
        {days.slice(0, parseISO(endOfMonth(month)).getDate() + parseISO(month).getDay() > 35 ? 42 : 35).map((d) => {
          const inMonth = d.slice(0, 7) === month.slice(0, 7);
          const ev = byDay.get(d) ?? [];
          const kinds = Array.from(new Set(ev.map((e) => e.kind))).slice(0, 3);
          return (
            <button key={d} onClick={() => setSelected(d)} className={cx("flex flex-col items-center gap-0.5 rounded-lg py-1", selected === d ? "bg-sky-100" : "hover:bg-sky-50")} aria-label={`${formatDate(d)}: ${ev.length} eventos`}>
              <span className={cx("grid size-6 place-items-center rounded-full text-xs tabular", d === today ? "bg-ink font-semibold text-white" : inMonth ? "text-ink" : "text-slate-300")}>{parseISO(d).getDate()}</span>
              <span className="flex h-1.5 gap-0.5">
                {kinds.map((k) => (
                  <span key={k} className={cx("size-1.5 rounded-full", CAL_STYLE[k].dot)} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 border-t border-line pt-3">
        <p className="mb-1.5 text-xs font-semibold text-muted">{formatDate(selected)}</p>
        {list.length === 0 ? (
          <p className="text-sm text-muted">Nenhum vencimento.</p>
        ) : (
          <ul className="space-y-1">
            {list.slice(0, 4).map((e) => (
              <li key={e.id}>
                <button onClick={() => (e.billId ? actions.viewBill(e.billId) : setDetail(e))} className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-[13px] hover:bg-sky-50">
                  <span className={cx("size-2 shrink-0 rounded-full", CAL_STYLE[e.kind].dot)} />
                  <span className="min-w-0 flex-1 truncate">{e.title}</span>
                  {e.amount !== undefined && <span className="tabular font-semibold">{formatBRL(e.amount)}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {detail && <EventDetail event={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
