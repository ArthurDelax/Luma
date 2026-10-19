/**
 * Fluxo de caixa projetado: parte do saldo informado e soma, dia a dia, o que
 * entra (contas a receber) e o que sai (contas a pagar e despesas recorrentes
 * ainda não lançadas). Aponta o primeiro dia em que o caixa fica negativo e
 * sugere o que fazer. Funções puras, sem React.
 *
 * Regras conservadoras:
 *  - Contas a pagar vencidas e não pagas entram HOJE (o dinheiro ainda vai sair).
 *  - Contas a receber vencidas NÃO entram na projeção (não há garantia de que o
 *    cliente pague); aparecem à parte, como valor a cobrar.
 */

import { addDays, diffDays } from "./dates.ts";
import { occurrencesInRange } from "./domain.ts";
import type { ISODate, LumaData } from "./types.ts";

export type FlowKind = "pagar" | "recorrente" | "receber";

export interface FlowItem {
  id: string;
  kind: FlowKind;
  date: ISODate;
  /** Valor sempre positivo; o sentido vem de `kind`. */
  amount: number;
  label: string;
  party: string;
  category?: string;
  /** Conta a pagar vencida, lançada para hoje. */
  overdue?: boolean;
}

export interface FlowDay {
  date: ISODate;
  inflow: number;
  outflow: number;
  balance: number;
}

export interface Suggestion {
  kind: "cobrar" | "antecipar" | "negociar";
  title: string;
  detail: string;
  amount: number;
}

export interface CashProjection {
  hasBalance: boolean;
  start: number;
  /** Saldo informado há mais de 7 dias. */
  stale: boolean;
  from: ISODate;
  to: ISODate;
  days: FlowDay[];
  items: FlowItem[];
  totalIn: number;
  totalOut: number;
  end: number;
  lowest: { date: ISODate; balance: number };
  firstNegative?: { date: ISODate; balance: number; daysAhead: number; dueThatDay: FlowItem[] };
  overdueReceivables: { count: number; total: number };
  suggestions: Suggestion[];
}

const round = (n: number) => Math.round(n * 100) / 100;
/** Saídas que normalmente não dá para adiar sem custo alto. */
const HARD_TO_DELAY = ["Impostos e taxas", "Folha e encargos"];

export function projectCash(data: LumaData, today: ISODate, horizonDays = 30): CashProjection {
  const to = addDays(today, horizonDays);
  const start = data.cash?.balance ?? 0;
  const items: FlowItem[] = [];

  for (const b of data.bills) {
    if (b.paidAt) continue;
    if (b.dueDate > to) continue;
    const overdue = b.dueDate < today;
    items.push({ id: b.id, kind: "pagar", date: overdue ? today : b.dueDate, amount: b.amount, label: b.description, party: b.supplier, category: b.category, overdue });
  }
  for (const o of occurrencesInRange(data.recurring, data.bills, today, to)) {
    if (o.bill) continue; // já lançada como conta a pagar
    items.push({ id: `${o.recurring.id}|${o.date}`, kind: "recorrente", date: o.date, amount: o.recurring.amount, label: o.recurring.description, party: o.recurring.supplier ?? o.recurring.description, category: o.recurring.category });
  }
  let overdueCount = 0;
  let overdueTotal = 0;
  for (const r of data.receivables ?? []) {
    if (r.receivedAt) continue;
    if (r.dueDate < today) {
      overdueCount++;
      overdueTotal += r.amount;
      continue;
    }
    if (r.dueDate > to) continue;
    items.push({ id: r.id, kind: "receber", date: r.dueDate, amount: r.amount, label: r.description, party: r.customer, category: r.category });
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "receber" ? -1 : 1));

  const days: FlowDay[] = [];
  let balance = start;
  let i = 0;
  let lowest = { date: today, balance: start };
  let firstNegative: CashProjection["firstNegative"];
  for (let d = today; d <= to; d = addDays(d, 1)) {
    let inflow = 0;
    let outflow = 0;
    while (i < items.length && items[i].date === d) {
      const it = items[i++];
      if (it.kind === "receber") inflow += it.amount;
      else outflow += it.amount;
    }
    balance = round(balance + inflow - outflow);
    days.push({ date: d, inflow: round(inflow), outflow: round(outflow), balance });
    if (balance < lowest.balance) lowest = { date: d, balance };
    if (!firstNegative && balance < 0) {
      firstNegative = { date: d, balance, daysAhead: diffDays(today, d), dueThatDay: items.filter((x) => x.date === d && x.kind !== "receber") };
    }
  }

  const totalIn = round(items.filter((x) => x.kind === "receber").reduce((s, x) => s + x.amount, 0));
  const totalOut = round(items.filter((x) => x.kind !== "receber").reduce((s, x) => s + x.amount, 0));

  const suggestions: Suggestion[] = [];
  if (firstNegative) {
    const gap = -firstNegative.balance;
    if (overdueTotal > 0) {
      suggestions.push({
        kind: "cobrar",
        title: `Cobrar ${overdueCount} ${overdueCount === 1 ? "cliente em atraso" : "clientes em atraso"}`,
        detail: "Valores vencidos que não entram na previsão até serem pagos.",
        amount: round(overdueTotal),
      });
    }
    const later = items.filter((x) => x.kind === "receber" && x.date > firstNegative!.date).sort((a, b) => b.amount - a.amount).slice(0, 3);
    if (later.length) {
      suggestions.push({
        kind: "antecipar",
        title: "Antecipar recebimentos",
        detail: later.map((x) => `${x.party} (${x.date.slice(8, 10)}/${x.date.slice(5, 7)})`).join(", "),
        amount: round(later.reduce((s, x) => s + x.amount, 0)),
      });
    }
    const movable = items
      .filter((x) => x.kind !== "receber" && x.date <= firstNegative!.date && !HARD_TO_DELAY.includes(x.category ?? ""))
      .sort((a, b) => b.amount - a.amount);
    const pick: FlowItem[] = [];
    let covered = 0;
    for (const x of movable) {
      if (covered >= gap || pick.length >= 3) break;
      pick.push(x);
      covered += x.amount;
    }
    if (pick.length) {
      suggestions.push({
        kind: "negociar",
        title: "Negociar novas datas",
        detail: pick.map((x) => x.party).join(", "),
        amount: round(pick.reduce((s, x) => s + x.amount, 0)),
      });
    }
  }

  return {
    hasBalance: !!data.cash,
    start,
    stale: !!data.cash && diffDays(data.cash.balanceDate, today) > 7,
    from: today,
    to,
    days,
    items,
    totalIn,
    totalOut,
    end: days.length ? days[days.length - 1].balance : start,
    lowest,
    firstNegative,
    overdueReceivables: { count: overdueCount, total: round(overdueTotal) },
    suggestions,
  };
}

/** Situação de uma conta a receber. */
export type ReceivableStatus = "recebido" | "atrasado" | "a_receber";
export function receivableStatus(r: { receivedAt?: string; dueDate: string }, today: ISODate): ReceivableStatus {
  if (r.receivedAt) return "recebido";
  return r.dueDate < today ? "atrasado" : "a_receber";
}
