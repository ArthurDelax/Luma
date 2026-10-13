"use client";

import { useMemo } from "react";
import { LuArrowUpRight, LuBell, LuCircleCheck, LuClock, LuFileText, LuReceipt, LuTriangleAlert } from "react-icons/lu";
import { addDays, addMonthsClamped, diffDays, formatDate, formatDateLong, monthKey, monthLabel, relativeDays, startOfMonth } from "@/lib/dates";
import { docSituation, ALERT_LEVEL_LABEL } from "@/lib/domain";
import { formatBRL } from "@/lib/format";
import { useStore } from "@/lib/store";
import { CategoryBars, StackedBars } from "../../charts/Charts";
import { Badge, Button, cx, EmptyState } from "../../ui";
import { useBillActions } from "../bills/BillActions";
import { Ribbon, type RibbonEvent } from "../Ribbon";
import { MiniCalendar } from "./CalendarPage";
import { navigate } from "../routing";
import { useUnreadAlerts } from "../Shell";
import { StatusBadge, sumAmount, useDerived } from "../shared";

function Kpi({ label, value, sub, tone = "default", icon, onClick }: { label: string; value: string; sub?: React.ReactNode; tone?: "default" | "overdue" | "soon" | "paid"; icon: React.ReactNode; onClick?: () => void }) {
  const toneCls = {
    default: "text-navy-600 bg-sky-100",
    overdue: "text-overdue bg-overdue-soft",
    soon: "text-soon bg-soon-soft",
    paid: "text-paid bg-paid-soft",
  }[tone];
  return (
    <button type="button" onClick={onClick} className="card group flex flex-col gap-3 p-4 text-left transition-colors hover:border-sky-300 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-muted">{label}</span>
        <span className={cx("grid size-8 place-items-center rounded-lg [&>svg]:size-4", toneCls)}>{icon}</span>
      </div>
      <span className="font-display text-[1.6rem] font-semibold leading-none tracking-tight tabular">{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </button>
  );
}

export function Dashboard() {
  const { data, today } = useStore();
  const { withStatus, open, overdue, next7, upcomingOccurrences } = useDerived();
  const actions = useBillActions();
  const { unread, all } = useUnreadAlerts();

  const monthStart = startOfMonth(today);
  const paidThisMonth = withStatus.filter((x) => x.status === "pago" && x.bill.paidAt && x.bill.paidAt >= monthStart);

  const docsSoon = data.documents.filter((d) => d.kind === "documento" && ["proximo", "vence_hoje", "vencido"].includes(docSituation(d, today).situation));
  const contractsSoon = data.documents.filter((d) => d.kind === "contrato" && ["proximo", "vence_hoje", "vencido"].includes(docSituation(d, today).situation));

  const monthly = useMemo(() => {
    const months = Array.from({ length: 7 }, (_, i) => monthKey(addMonthsClamped(monthStart, i - 5, 1)));
    return months.map((k) => {
      const inMonth = withStatus.filter((x) => monthKey(x.bill.dueDate) === k);
      return {
        label: monthLabel(k),
        title: monthLabel(k, false),
        highlight: k === monthKey(today),
        segments: [
          { key: "pago", value: sumAmount(inMonth.filter((x) => x.status === "pago")) },
          { key: "vencido", value: sumAmount(inMonth.filter((x) => x.status === "vencido")) },
          { key: "aberto", value: sumAmount(inMonth.filter((x) => x.status === "pendente")) },
        ],
      };
    });
  }, [withStatus, monthStart, today]);

  const byCategory = useMemo(() => {
    const from = addMonthsClamped(monthStart, -5, 1);
    const map = new Map<string, number>();
    for (const b of data.bills) if (b.dueDate >= from) map.set(b.category, (map.get(b.category) ?? 0) + b.amount);
    return Array.from(map, ([label, value]) => ({ label, value }));
  }, [data.bills, monthStart]);

  const ribbonEvents: RibbonEvent[] = useMemo(() => {
    const ev: RibbonEvent[] = [];
    for (const x of open) ev.push({ id: x.bill.id, date: x.bill.dueDate, kind: x.status === "vencido" ? "vencida" : "conta", label: x.bill.description, amount: x.bill.amount, onClick: () => actions.viewBill(x.bill.id) });
    for (const o of upcomingOccurrences) if (o.date <= addDays(today, 30)) ev.push({ id: `${o.recurring.id}${o.date}`, date: o.date, kind: "recorrente", label: `${o.recurring.description} (prevista)`, amount: o.recurring.amount, onClick: () => navigate("recorrentes") });
    for (const d of data.documents) {
      if (d.status === "encerrado") continue;
      const days = diffDays(today, d.endDate);
      if (days <= 30) ev.push({ id: d.id, date: d.endDate, kind: days < 0 ? "vencida" : d.kind, label: `${d.name} (vencimento)`, onClick: () => navigate("documentos") });
    }
    return ev;
  }, [open, upcomingOccurrences, data.documents, today, actions]);

  const upcoming = [...open].sort((a, b) => a.bill.dueDate.localeCompare(b.bill.dueDate)).slice(0, 7);

  if (data.bills.length === 0 && data.documents.length === 0 && data.recurring.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={<LuReceipt className="size-6" />}
          title="Seu painel está vazio"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => actions.newBill()}>Cadastrar primeira conta</Button>
              <Button variant="secondary" onClick={() => navigate("ajustes")}>
                Restaurar dados de exemplo
              </Button>
            </div>
          }
        >
          Cadastre contas, despesas recorrentes e documentos para acompanhar seus vencimentos aqui.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">{formatDateLong(today)}</p>
          <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight">Visão geral</h1>
        </div>
        {unread.length > 0 && (
          <a href="#/alertas" className="inline-flex items-center gap-2 self-start rounded-full bg-overdue-soft px-3 py-1.5 text-[13px] font-semibold text-overdue hover:bg-[#fbdcdc]">
            <LuBell className="size-4" />
            {unread.length} {unread.length === 1 ? "alerta não lido" : "alertas não lidos"}
          </a>
        )}
      </div>

      {/* Faixa de vencimentos */}
      <section className="overflow-hidden rounded-[18px] bg-navy-900 p-4 text-white shadow-[var(--shadow-card)] sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Próximos 30 dias</h2>
            <p className="text-sm text-white/60">Cada coluna é um dia; a altura mostra quanto vence nele. Toque em um dia para ver os itens.</p>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-white/55">Em aberto</p>
              <p className="font-display text-xl font-semibold tabular">{formatBRL(sumAmount(open))}</p>
            </div>
            <div>
              <p className="text-xs text-white/55">Vencido</p>
              <p className="font-display text-xl font-semibold tabular text-[#ff9a9a]">{formatBRL(sumAmount(overdue))}</p>
            </div>
          </div>
        </div>
        <Ribbon today={today} events={ribbonEvents} tone="dark" />
      </section>

      {/* Indicadores */}
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi label="Contas a pagar" value={String(open.length)} sub={`${formatBRL(sumAmount(open))} em aberto`} icon={<LuReceipt />} onClick={() => navigate("contas", { status: "abertas" })} />
        <Kpi label="Vencidas" value={String(overdue.length)} sub={overdue.length ? formatBRL(sumAmount(overdue)) : "Nenhuma conta atrasada"} tone="overdue" icon={<LuTriangleAlert />} onClick={() => navigate("contas", { status: "vencido" })} />
        <Kpi label="Vencem em 7 dias" value={String(next7.length)} sub={next7.length ? formatBRL(sumAmount(next7)) : "Nada para esta semana"} tone="soon" icon={<LuClock />} onClick={() => navigate("contas", { status: "7dias" })} />
        <Kpi label="Pagas no mês" value={String(paidThisMonth.length)} sub={formatBRL(sumAmount(paidThisMonth))} tone="paid" icon={<LuCircleCheck />} onClick={() => navigate("contas", { status: "pago" })} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <section className="card p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold">Despesas por mês</h2>
              <p className="text-xs text-muted">Pelo mês de vencimento, últimos 6 meses e o próximo</p>
            </div>
          </div>
          <StackedBars
            data={monthly}
            series={[
              { key: "pago", label: "Pago", color: "#12264a" },
              { key: "vencido", label: "Vencido", color: "#c23b3b" },
              { key: "aberto", label: "A vencer", color: "#9ec6f2" },
            ]}
          />
        </section>

        <section className="card p-4 sm:p-6">
          <h2 className="font-display text-base font-semibold">Despesas por categoria</h2>
          <p className="mb-4 text-xs text-muted">Últimos 6 meses</p>
          {byCategory.length ? <CategoryBars data={byCategory} limit={6} /> : <p className="text-sm text-muted">Sem despesas no período.</p>}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 pb-2 pt-4 sm:px-6 sm:pt-5">
            <h2 className="font-display text-base font-semibold">Próximos vencimentos</h2>
            <a href="#/contas" className="inline-flex items-center gap-1 text-[13px] font-semibold text-navy-600 hover:underline">
              Ver todas <LuArrowUpRight className="size-3.5" />
            </a>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState icon={<LuCircleCheck className="size-6" />} title="Tudo em dia">
              Nenhuma conta em aberto.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map(({ bill }) => (
                <li key={bill.id}>
                  <button onClick={() => actions.viewBill(bill.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sky-50/60 sm:px-6">
                    <div className="hidden w-12 shrink-0 flex-col items-center rounded-lg border border-line py-1 sm:flex">
                      <span className="text-[10px] font-semibold text-muted">{monthLabel(bill.dueDate.slice(0, 7)).split("/")[0]}</span>
                      <span className="font-display text-lg font-semibold leading-none">{bill.dueDate.slice(8, 10)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{bill.description}</p>
                      <p className="truncate text-xs text-muted">
                        {bill.supplier} <span className="sm:hidden">— {formatDate(bill.dueDate)}</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular">{formatBRL(bill.amount)}</span>
                      <StatusBadge bill={bill} today={today} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
        <section className="card p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Calendário financeiro</h2>
            <a href="#/calendario" className="inline-flex items-center gap-1 text-[13px] font-semibold text-navy-600 hover:underline">
              Abrir <LuArrowUpRight className="size-3.5" />
            </a>
          </div>
          <MiniCalendar />
        </section>
        <section className="card p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Contratos e documentos</h2>
            <a href="#/documentos" className="inline-flex items-center gap-1 text-[13px] font-semibold text-navy-600 hover:underline">
              Gerenciar <LuArrowUpRight className="size-3.5" />
            </a>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-doc-soft/70 p-3">
              <p className="text-xs font-semibold text-doc">Documentos a vencer</p>
              <p className="font-display text-2xl font-semibold">{docsSoon.length}</p>
            </div>
            <div className="rounded-xl bg-contract-soft/70 p-3">
              <p className="text-xs font-semibold text-contract">Contratos a vencer</p>
              <p className="font-display text-2xl font-semibold">{contractsSoon.length}</p>
            </div>
          </div>
          <ul className="space-y-2.5">
            {[...docsSoon, ...contractsSoon]
              .sort((a, b) => a.endDate.localeCompare(b.endDate))
              .slice(0, 5)
              .map((d) => {
                const { days } = docSituation(d, today);
                return (
                  <li key={d.id} className="flex items-center gap-3 text-sm">
                    <LuFileText className={cx("size-4 shrink-0", d.kind === "contrato" ? "text-contract" : "text-doc")} />
                    <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
                    <Badge tone={days < 0 ? "overdue" : days <= 7 ? "soon" : "neutral"}>{days < 0 ? `vencido ${relativeDays(days)}` : days === 0 ? "vence hoje" : `vence ${relativeDays(days)}`}</Badge>
                  </li>
                );
              })}
            {docsSoon.length + contractsSoon.length === 0 && <li className="text-sm text-muted">Nenhum contrato ou documento vence nos próximos 30 dias.</li>}
          </ul>
          {all.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="mb-2 text-xs font-semibold text-muted">Alertas mais urgentes</p>
              <ul className="space-y-1.5">
                {all.slice(0, 3).map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-[13px]">
                    <span className={cx("size-2 rounded-full", a.severity === "critico" ? "bg-overdue" : a.severity === "atencao" ? "bg-soon" : "bg-sky-400")} />
                    <span className="min-w-0 flex-1 truncate">{a.title}</span>
                    <span className="shrink-0 text-xs text-muted">{ALERT_LEVEL_LABEL[a.level]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
        </div>
      </div>
    </div>
  );
}
