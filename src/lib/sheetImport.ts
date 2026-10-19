/**
 * Importação de contas a partir de planilha (CSV exportado do Excel/Google Planilhas).
 * Tudo acontece no navegador. Funções puras, testáveis.
 */

import { allCategories } from "./domain.ts";
import { brDateToISO, isValidISO } from "./dates.ts";
import { normalizeText, parseBRL } from "./format.ts";
import type { CustomCategory, ISODate } from "./types.ts";

export type SheetField = "name" | "description" | "amount" | "dueDate" | "category" | "paidAt" | "phone";
export type Mapping = Partial<Record<SheetField, number>>;

export const FIELD_LABEL: Record<SheetField, string> = {
  name: "Fornecedor / cliente",
  description: "Descrição",
  amount: "Valor",
  dueDate: "Vencimento",
  category: "Categoria",
  paidAt: "Data do pagamento",
  phone: "WhatsApp do cliente",
};

/** Lê CSV com separador ; , ou tab, aspas e BOM. */
export function parseCSV(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const count = (c: string) => firstLine.split(c).length - 1;
  const sep = [";", "\t", ","].sort((a, b) => count(b) - count(a))[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

const HINTS: Record<SheetField, RegExp> = {
  name: /^(fornecedor|cliente|beneficiario|favorecido|empresa|nome|pagador|sacado|recebedor)/,
  description: /^(descricao|historico|referente|servico|produto|conta|item|titulo|detalhe)/,
  amount: /^(valor|total|quantia|preco|montante)/,
  dueDate: /^(vencimento|venc|data venc|data de venc|data)/,
  category: /^(categoria|tipo|grupo|classificacao|centro de custo)/,
  paidAt: /^(pago em|pagamento|data pag|data do pag|recebido em|recebimento|data receb|quitacao|baixa)/,
  phone: /^(whatsapp|celular|telefone|fone|contato)/,
};

/** Sugere qual coluna corresponde a cada campo, pelo nome do cabeçalho. */
export function guessMapping(headers: string[]): Mapping {
  const m: Mapping = {};
  const used = new Set<number>();
  // a ordem importa: "data do pagamento" antes de "data" (vencimento)
  for (const f of ["paidAt", "dueDate", "amount", "name", "description", "category", "phone"] as SheetField[]) {
    const i = headers.findIndex((h, idx) => !used.has(idx) && HINTS[f].test(normalizeText(h)));
    if (i >= 0) {
      m[f] = i;
      used.add(i);
    }
  }
  return m;
}

export function parseDate(text: string): ISODate | undefined {
  const t = (text ?? "").trim();
  if (!t) return undefined;
  if (isValidISO(t.slice(0, 10)) && /^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return brDateToISO(t);
}

export interface SheetRow {
  line: number;
  name: string;
  description: string;
  amount?: number;
  dueDate?: ISODate;
  category?: string;
  paidAt?: ISODate;
  phone?: string;
  errors: string[];
}

/** Converte as linhas usando o mapeamento. A primeira linha é o cabeçalho. */
export function buildRows(table: string[][], m: Mapping, target: "pagar" | "receber", custom: CustomCategory[] = []): SheetRow[] {
  const cats = allCategories(custom);
  const byNorm = new Map(cats.map((c) => [normalizeText(c), c]));
  const get = (r: string[], f: SheetField) => (m[f] !== undefined ? (r[m[f]!] ?? "").trim() : "");
  return table.slice(1).map((r, i) => {
    const errors: string[] = [];
    const name = get(r, "name");
    const desc = get(r, "description");
    const amountRaw = get(r, "amount").replace(/^R\$\s*/, "");
    const amount = parseBRL(amountRaw.replace(/^-/, ""));
    const dueDate = parseDate(get(r, "dueDate"));
    const paidAt = parseDate(get(r, "paidAt"));
    const catRaw = get(r, "category");
    let category: string | undefined;
    if (target === "pagar") category = byNorm.get(normalizeText(catRaw)) ?? (catRaw ? undefined : "Outros");
    else category = catRaw || undefined;
    if (!name && !desc) errors.push(target === "pagar" ? "sem fornecedor/descrição" : "sem cliente/descrição");
    if (amount === undefined || amount <= 0) errors.push("valor inválido");
    if (!dueDate) errors.push("vencimento inválido");
    if (target === "pagar" && catRaw && !category) category = "Outros";
    return {
      line: i + 2,
      name: name || desc,
      description: desc || name,
      amount,
      dueDate,
      category,
      paidAt,
      phone: get(r, "phone").replace(/\D/g, "") || undefined,
      errors,
    };
  });
}
