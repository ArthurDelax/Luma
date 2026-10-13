/**
 * Regras de negócio da Luma: status de contas, recorrências, alertas e duplicidades.
 * Funções puras (sem React e sem armazenamento), fáceis de testar e de reaproveitar
 * quando houver um backend.
 */

import { addDays, addMonthsClamped, diffDays, isValidISO, parseISO, toISO } from "./dates.ts";
import { normalizeText, onlyDigits } from "./format.ts";
import type { Bill, BillStatus, BusinessDocument, Frequency, ISODate, RecurringExpense } from "./types.ts";

export const CATEGORIES = [
  "Aluguel e condomínio",
  "Energia",
  "Água e saneamento",
  "Internet e telefonia",
  "Software e assinaturas",
  "Fornecedores",
  "Impostos e taxas",
  "Folha e encargos",
  "Contabilidade e jurídico",
  "Marketing",
  "Manutenção",
  "Seguros",
  "Outros",
] as const;

export const DOCUMENT_TYPES: Record<BusinessDocument["kind"], string[]> = {
  contrato: ["Contrato com fornecedor", "Contrato de prestação de serviços", "Contrato de locação", "Seguro empresarial", "Outro contrato"],
  documento: ["Certificado digital", "Licença", "Alvará", "Certidão", "Documento administrativo", "Outro documento"],
};

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  anual: "Anual",
};

const FREQUENCY_MONTHS: Record<Frequency, number> = { mensal: 1, trimestral: 3, anual: 12 };

/* ------------------------------------------------------------------ */
/* Contas                                                               */
/* ------------------------------------------------------------------ */

export function billStatus(bill: Bill, today: ISODate): BillStatus {
  if (bill.paidAt) return "pago";
  return bill.dueDate < today ? "vencido" : "pendente";
}

export const STATUS_LABEL: Record<BillStatus, string> = {
  pendente: "Pendente",
  pago: "Pago",
  vencido: "Vencido",
};

export interface DuplicateMatch {
  bill: Bill;
  reason: string;
  /** "forte" bloqueia (mesma linha digitável); "possivel" pede confirmação. */
  level: "forte" | "possivel";
}

/** Procura contas que possam ser a mesma cobrança. */
export function findDuplicates(candidate: Partial<Bill>, bills: Bill[]): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  const line = onlyDigits(candidate.digitableLine);
  const supplier = normalizeText(candidate.supplier);
  const doc = normalizeText(candidate.documentNumber);
  for (const b of bills) {
    if (b.id === candidate.id) continue;
    if (line && onlyDigits(b.digitableLine) === line) {
      matches.push({ bill: b, reason: "mesma linha digitável", level: "forte" });
      continue;
    }
    if (candidate.recurringId && b.recurringId === candidate.recurringId && b.occurrenceDate === candidate.occurrenceDate) {
      matches.push({ bill: b, reason: "mesma despesa recorrente e competência", level: "forte" });
      continue;
    }
    const sameSupplier = supplier && normalizeText(b.supplier) === supplier;
    if (sameSupplier && doc && normalizeText(b.documentNumber) === doc) {
      matches.push({ bill: b, reason: "mesmo fornecedor e nº do documento", level: "possivel" });
      continue;
    }
    if (
      sameSupplier &&
      candidate.amount !== undefined &&
      Math.abs(b.amount - candidate.amount) < 0.005 &&
      candidate.dueDate &&
      b.dueDate === candidate.dueDate
    ) {
      matches.push({ bill: b, reason: "mesmo fornecedor, valor e vencimento", level: "possivel" });
    }
  }
  return matches;
}

/* ------------------------------------------------------------------ */
/* Recorrências                                                         */
/* ------------------------------------------------------------------ */

export interface Occurrence {
  recurring: RecurringExpense;
  date: ISODate;
  /** Conta já lançada para esta ocorrência, se houver. */
  bill?: Bill;
}

/** Datas de vencimento de uma despesa recorrente dentro de [from, to]. */
export function occurrenceDates(r: RecurringExpense, from: ISODate, to: ISODate): ISODate[] {
  if (!isValidISO(r.startDate)) return [];
  const step = FREQUENCY_MONTHS[r.frequency];
  const start = parseISO(r.startDate);
  // primeira data: dia de vencimento no mês de início (ou no seguinte, se já passou)
  let first = addMonthsClamped(toISO(new Date(start.getFullYear(), start.getMonth(), 1)), 0, r.dayOfMonth);
  if (first < r.startDate) first = addMonthsClamped(first, 1, r.dayOfMonth);
  const dates: ISODate[] = [];
  const end = r.endDate && isValidISO(r.endDate) && r.endDate < to ? r.endDate : to;
  for (let i = 0; i < 600; i++) {
    const d = addMonthsClamped(first, i * step, r.dayOfMonth);
    if (d > end) break;
    if (d >= from) dates.push(d);
  }
  return dates;
}

/**
 * Ocorrências previstas no período, ligadas às contas já lançadas.
 * Nada é gravado aqui: as ocorrências são calculadas, então não há como duplicar.
 */
export function occurrencesInRange(recurring: RecurringExpense[], bills: Bill[], from: ISODate, to: ISODate, includeInactive = false): Occurrence[] {
  const launched = new Map<string, Bill>();
  for (const b of bills) if (b.recurringId && b.occurrenceDate) launched.set(`${b.recurringId}|${b.occurrenceDate}`, b);
  const out: Occurrence[] = [];
  for (const r of recurring) {
    if (!r.active && !includeInactive) continue;
    for (const date of occurrenceDates(r, from, to)) {
      out.push({ recurring: r, date, bill: launched.get(`${r.id}|${date}`) });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function nextOccurrence(r: RecurringExpense, today: ISODate, bills: Bill[]): ISODate | undefined {
  const occ = occurrencesInRange([r], bills, today, addDays(today, 800), true).find((o) => !o.bill);
  return occ?.date;
}

/** Valor mensal equivalente (para totais). */
export function monthlyEquivalent(r: RecurringExpense): number {
  return r.amount / FREQUENCY_MONTHS[r.frequency];
}

/* ------------------------------------------------------------------ */
/* Contratos e documentos                                               */
/* ------------------------------------------------------------------ */

export type DocSituation = "vencido" | "vence_hoje" | "proximo" | "vigente" | "encerrado";

export function docSituation(doc: BusinessDocument, today: ISODate): { situation: DocSituation; days: number } {
  const days = diffDays(today, doc.endDate);
  if (doc.status === "encerrado") return { situation: "encerrado", days };
  if (days < 0) return { situation: "vencido", days };
  if (days === 0) return { situation: "vence_hoje", days };
  if (days <= 30) return { situation: "proximo", days };
  return { situation: "vigente", days };
}

/* ------------------------------------------------------------------ */
/* Alertas                                                              */
/* ------------------------------------------------------------------ */

export type AlertLevel = "vencido" | "hoje" | "3" | "7" | "15" | "30";
export type AlertSource = "conta" | "recorrente" | "contrato" | "documento";

export interface Alert {
  id: string;
  level: AlertLevel;
  source: AlertSource;
  title: string;
  detail: string;
  date: ISODate;
  days: number;
  refId: string;
  severity: "critico" | "atencao" | "info";
}

/** Regras: avisos a 30, 15, 7 e 3 dias, no dia e depois de vencido. */
export const ALERT_THRESHOLDS = [30, 15, 7, 3] as const;

export function alertLevelFor(days: number, maxDays = 30): AlertLevel | undefined {
  if (days < 0) return "vencido";
  if (days === 0) return "hoje";
  for (const t of [3, 7, 15, 30] as const) {
    if (t > maxDays) break;
    if (days <= t) return String(t) as AlertLevel;
  }
  return undefined;
}

export const ALERT_LEVEL_LABEL: Record<AlertLevel, string> = {
  vencido: "Vencido",
  hoje: "Vence hoje",
  "3": "Até 3 dias",
  "7": "Até 7 dias",
  "15": "Até 15 dias",
  "30": "Até 30 dias",
};

function severity(level: AlertLevel): Alert["severity"] {
  if (level === "vencido" || level === "hoje") return "critico";
  if (level === "3" || level === "7") return "atencao";
  return "info";
}

export function computeAlerts(
  data: { bills: Bill[]; recurring: RecurringExpense[]; documents: BusinessDocument[] },
  today: ISODate,
): Alert[] {
  const alerts: Alert[] = [];

  for (const d of data.documents) {
    if (d.status === "encerrado") continue;
    const days = diffDays(today, d.endDate);
    const level = alertLevelFor(days, 30);
    if (!level) continue;
    alerts.push({
      id: `${d.kind}:${d.id}:${d.endDate}:${level}`,
      level,
      source: d.kind,
      title: d.name,
      detail: `${d.type} · ${d.party}`,
      date: d.endDate,
      days,
      refId: d.id,
      severity: severity(level),
    });
  }

  // Contas: alertas a partir de 7 dias antes (contas costumam ter ciclos curtos).
  for (const b of data.bills) {
    if (b.paidAt) continue;
    const days = diffDays(today, b.dueDate);
    const level = alertLevelFor(days, 7);
    if (!level) continue;
    alerts.push({
      id: `conta:${b.id}:${b.dueDate}:${level}`,
      level,
      source: "conta",
      title: b.description,
      detail: b.supplier,
      date: b.dueDate,
      days,
      refId: b.id,
      severity: severity(level),
    });
  }

  // Recorrentes ainda não lançadas que vencem em até 7 dias.
  for (const o of occurrencesInRange(data.recurring, data.bills, addDays(today, -15), addDays(today, 7))) {
    if (o.bill) continue;
    const days = diffDays(today, o.date);
    const level = alertLevelFor(days, 7);
    if (!level) continue;
    alerts.push({
      id: `recorrente:${o.recurring.id}:${o.date}:${level}`,
      level,
      source: "recorrente",
      title: `${o.recurring.description} (não lançada)`,
      detail: "Despesa recorrente prevista — lance a conta para controlar o pagamento",
      date: o.date,
      days,
      refId: o.recurring.id,
      severity: severity(level),
    });
  }

  const order: Record<AlertLevel, number> = { vencido: 0, hoje: 1, "3": 2, "7": 3, "15": 4, "30": 5 };
  return alerts.sort((a, b) => order[a.level] - order[b.level] || a.date.localeCompare(b.date));
}
