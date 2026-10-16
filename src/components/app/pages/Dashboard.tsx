"use client";

import { useMemo } from "react";
import { LuArrowUpRight, LuCircleCheck, LuClock, LuFileText, LuReceipt, LuShieldCheck, LuTriangleAlert } from "react-icons/lu";
import { addDays, addMonthsClamped, diffDays, formatDate, formatDateLong, monthKey, monthLabel, relativeDays, startOfMonth } from "@/lib/dates";
import { docSituation, ALERT_LEVEL_LABEL } from "@/lib/domain";
import { formatBRL } from "@/lib/format";
import { useStore } from "@/lib/store";
import { useWorkspace } from "@/lib/workspace";
import { CategoryBars, StackedBars } from "../../charts/Charts";
import { Badge, Button, cx, EmptyState, LogoMark } from "../../ui";
import { useBillActions } from "../bills/BillActions";
import { insightFor } from "../bills/BillInsights";
import { percentText } from "@/lib/insights";
import { Ribbon, type RibbonEvent } from "../Ribbon";
import { MiniCalendar } from "./CalendarPage";
import { navigate } from "../routing";
import { useUnreadAlerts } from "../Shell";
import { StatusBadge, sumAmount, useDerived } from "../shared";

function Kpi({ label, value, sub, tone = "default", icon, onClick, share }: { label: string; value: string; sub?: React.ReactNode; tone?: "default" | "overdue" | "soon" | "paid"; icon: React.ReactNode; onClick?: () => void; share?: number }) {
  const toneCls = {
    default: "text-ink bg-sky-100",
    overdue: "text-overdue bg-overdue-soft",
    soon: "text-soon bg-soon-soft",
    paid: "text-paid bg-paid-soft",
  }[tone];
  const bar = { default: "bg-ink", overdue: "bg-overdue", soon: "bg-soon", paid: "bg-paid" }[tone];
  return (
    <button type="button" onClick={onClick} className="card group relative flex flex-col p-4 text-left transition-all hover:-translate-y-0.5 hover:border-ink/20 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className={cx("grid size-8 place-items-center rounded-full [&>svg]:size-4", toneCls)}>{icon}</span>
        <span className="text-[13px] font-semibold text-muted">{label}</span>
        <LuArrowUpRight className="ml-auto size-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <span className="mt-4 font-display text-[2.1rem] font-semibold leading-none tracking-[-0.03em] tabular">{value}</span>
      {sub && <span className="mt-1.5 text-xs text-muted">{sub}</span>}
      {share !== undefined && (
        <span className="mt-4 h-1 overflow-hidden rounded-full bg-sky-100" aria-hidden>
          <span className={cx("block h-full rounded-full", bar)} style={{ width: `${Math.max(2, Math.min(100, share * 100))}%` }} />
        </span>
      )}
    </button>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function Dashboard() {
  const { data, today } = useStore();
  const ws = useWorkspace();
  const companyName = ws.mode === "cloud" ? (ws.orgName ?? "") : "Empresa Demonstração";
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

  // Conferência inteligente: contas em aberto com boleto suspeito ou valor acima da média
  const flagged = useMemo(
    () =>
      open
        .map(({ bill }) => ({ bill, insight: insightFor(bill, data.bills) }))
        .filter(({ insight }) => insight.risks.length || insight.jump)
        .sort((a, b) => b.insight.risks.length - a.insight.risks.length || a.bill.dueDate.localeCompare(b.bill.dueDate))
        .slice(0, 4),
    [open, data.bills],
  );

  const header = (
    <div>
      <p className="text-sm text-muted">{formatDateLong(today)}</p>
      <h1 className="mt-1 font-display text-[1.9rem] font-semibold leading-tight tracking-[-0.03em] sm:text-[2.4rem]">{greeting()}{companyName ? `, ${companyName}` : ""}</h1>
    </div>
  );

  if (data.bills.length === 0 && data.documents.length === 0 && data.recurring.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <div className="card">
          <EmptyState
            icon={<LuReceipt className="size-6" />}
            title={ws.mode === "cloud" ? "Bem-vindo à Luma!" : "Seu painel está vazio"}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => actions.newBill()}>Cadastrar primeira conta</Button>
                {ws.mode === "cloud" ? (
                  <Button variant="secondary" onClick={actions.importBoleto}>
                    Importar boleto em PDF
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => navigate("ajustes")}>
                    Restaurar dados de exemplo
                  </Button>
                )}
              </div>
            }
          >
            {ws.mode === "cloud"
              ? "Comece cadastrando suas contas a pagar ou importando um boleto. Depois, adicione despesas recorrentes e contratos para acompanhar todos os vencimentos aqui."
              : "Cadastre contas, despesas recorrentes e documentos para acompanhar seus vencimentos aqui."}
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {header}
        {unread.length > 0 && (
          <a href="#/alertas" className="inline-flex items-center gap-2 self-start rounded-full border border-overdue/20 bg-white px-3.5 py-2 text-[13px] font-semibold text-overdue shadow-sm transition-colors hover:bg-overdue-soft sm:self-auto">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-overdue opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-overdue" />
            </span>
            {unread.length} {unread.length === 1 ? "alerta não lido" : "alertas não lidos"}
          </a>
        )}
      </div>

      {/* Conferência inteligente */}
      <section aria-label="Conferência da Luma" className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className={cx("grid size-8 place-items-center rounded-full", flagged.length ? "bg-overdue-soft text-overdue" : "bg-paid-soft text-paid")}>
              {flagged.length ? <LuTriangleAlert className="size-4" /> : <LuShieldCheck className="size-4" />}
            </span>
            <div>
              <h2 className="font-display text-base font-semibold">Conferência da Luma</h2>
              <p className="text-xs text-muted">{flagged.length ? "Contas que fogem do padrão do fornecedor. Confira antes de pagar." : "Nenhuma conta em aberto fora do padrão."}</p>
            </div>
          </div>
          <Button size="sm" variant="secondary" icon={<LuFileText className="size-4" />} onClick={() => navigate("relatorios", { pacote: "1" })}>
            Pacote do contador
          </Button>
        </div>
        {flagged.length > 0 && (
          <ul className="divide-y divide-line">
            {flagged.map(({ bill, insight }) => (
              <li key={bill.id}>
                <button type="button" onClick={() => actions.viewBill(bill.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-sky-50/60 sm:px-6">
                  <span className={cx("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", insight.risks.length ? "bg-overdue-soft text-overdue" : "bg-soon-soft text-soon")}>
                    {insight.risks.length ? <LuTriangleAlert className="size-3.5" /> : <LuArrowUpRight className="size-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-semibold">{bill.description}</span>
                      <span className="shrink-0 text-sm font-semibold tabular">{formatBRL(bill.amount)}</span>
                    </span>
                    <span className="mt-0.5 block text-[13px] text-slate-600">
                      {insight.risks.length
                        ? insight.risks[0].message
                        : `${percentText(insight.jump!.increase)} acima da média das últimas contas (${formatBRL(insight.jump!.average)}).`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Faixa de vencimentos */}
      <section className="dot-grid-light relative overflow-hidden rounded-[28px] bg-ink p-5 text-paper shadow-[var(--shadow-pop)] sm:p-7">
        <LogoMark tone="light" className="pointer-events-none absolute -bottom-24 -right-16 size-72 opacity-[0.04]" />
        <div className="relative mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-paper/55">Total em aberto</p>
            <p className="mt-1 font-display text-[2.4rem] font-semibold leading-none tracking-[-0.03em] tabular sm:text-[3rem]">{formatBRL(sumAmount(open))}</p>
            <p className="mt-3 text-sm text-paper/55">
              <span className="font-semibold text-[#ff8f86]">{formatBRL(sumAmount(overdue))}</span> vencido
              <span className="mx-2 text-paper/25">/</span>
              <span className="font-semibold text-paper">{formatBRL(sumAmount(next7))}</span> nos próximos 7 dias
            </p>
          </div>
          <div className="max-w-xs lg:text-right">
            <h2 className="font-display text-base font-semibold">Próximos 30 dias</h2>
            <p className="text-[13px] text-paper/50">A altura de cada coluna mostra quanto vence no dia. Toque para ver os itens.</p>
          </div>
        </div>
        <Ribbon today={today} events={ribbonEvents} tone="dark" />
      </section>

      {/* Indicadores */}
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi label="Contas a pagar" value={String(open.length)} sub={`${formatBRL(sumAmount(open))} em aberto`} share={withStatus.length ? open.length / withStatus.length : 0} icon={<LuReceipt />} onClick={() => navigate("contas", { status: "abertas" })} />
        <Kpi label="Vencidas" value={String(overdue.length)} sub={overdue.length ? formatBRL(sumAmount(overdue)) : "Nenhuma conta atrasada"} tone="overdue" share={open.length ? overdue.length / open.length : 0} icon={<LuTriangleAlert />} onClick={() => navigate("contas", { status: "vencido" })} />
        <Kpi label="Vencem em 7 dias" value={String(next7.length)} sub={next7.length ? formatBRL(sumAmount(next7)) : "Nada para esta semana"} tone="soon" share={open.length ? next7.length / open.length : 0} icon={<LuClock />} onClick={() => navigate("contas", { status: "7dias" })} />
        <Kpi label="Pagas no mês" value={String(paidThisMonth.length)} sub={formatBRL(sumAmount(paidThisMonth))} tone="paid" share={paidThisMonth.length / Math.max(1, paidThisMonth.length + open.filter((x) => x.bill.dueDate.slice(0, 7) === today.slice(0, 7)).length)} icon={<LuCircleCheck />} onClick={() => navigate("contas", { status: "pago" })} />
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
              { key: "pago", label: "Pago", color: "#111111" },
              { key: "vencido", label: "Vencido", color: "#cf3f3c" },
              { key: "aberto", label: "A vencer", color: "#c7c5bb" },
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
            <a href="#/contas" className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink underline-offset-4 hover:underline">
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
            <a href="#/calendario" className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink underline-offset-4 hover:underline">
              Abrir <LuArrowUpRight className="size-3.5" />
            </a>
          </div>
          <MiniCalendar />
        </section>
        <section className="card p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Contratos e documentos</h2>
            <a href="#/documentos" className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink underline-offset-4 hover:underline">
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
