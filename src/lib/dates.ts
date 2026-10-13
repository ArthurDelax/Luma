import type { ISODate } from "./types.ts";

/** Converte "AAAA-MM-DD" em Date local (meia-noite), sem problemas de fuso. */
export function parseISO(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toISO(date: Date): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO(): ISODate {
  return toISO(new Date());
}

export function isValidISO(iso: string | undefined | null): iso is ISODate {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = parseISO(iso);
  return toISO(d) === iso;
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Soma meses mantendo o dia desejado (limitado ao último dia do mês). */
export function addMonthsClamped(iso: ISODate, months: number, day?: number): ISODate {
  const d = parseISO(iso);
  const targetDay = day ?? d.getDate();
  const base = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(targetDay, last));
  return toISO(base);
}

/** Diferença em dias inteiros: b - a. */
export function diffDays(a: ISODate, b: ISODate): number {
  const ms = parseISO(b).getTime() - parseISO(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function monthKey(iso: ISODate): string {
  return iso.slice(0, 7);
}

export function startOfMonth(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonth(iso: ISODate): ISODate {
  const d = parseISO(startOfMonth(iso));
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Converte "dd/mm/aaaa" (ou dd/mm/aa) em ISO. Retorna undefined se inválida. */
export function brDateToISO(text: string): ISODate | undefined {
  const m = text.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!m) return undefined;
  let year = Number(m[3]);
  if (m[3].length === 2) year += 2000;
  const iso = `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return isValidISO(iso) ? iso : undefined;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function monthName(monthIndex: number): string {
  return MONTHS[monthIndex];
}

export function monthLabel(key: string, short = true): string {
  const [y, m] = key.split("-").map(Number);
  const name = short ? MONTHS_SHORT[m - 1] : MONTHS[m - 1];
  return short ? `${name}/${String(y).slice(2)}` : `${name} de ${y}`;
}

export function formatDate(iso: ISODate | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateLong(iso: ISODate): string {
  const d = parseISO(iso);
  return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}

export function relativeDays(days: number): string {
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  if (days === -1) return "ontem";
  if (days > 1) return `em ${days} dias`;
  return `há ${Math.abs(days)} dias`;
}
