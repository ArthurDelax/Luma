/**
 * Extrato bancário em OFX (o formato "Money/Quicken" que quase todo banco
 * oferece para download). Lido no navegador e cruzado com as contas abertas:
 * débitos → contas a pagar; créditos → contas a receber.
 */

import { diffDays, isValidISO } from "./dates.ts";
import type { Bill, ISODate, Receivable } from "./types.ts";

export interface StatementTx {
  id: string;
  date: ISODate;
  /** Negativo = saiu da conta; positivo = entrou. */
  amount: number;
  memo: string;
}

function tag(block: string, name: string): string | undefined {
  const m = new RegExp(`<${name}>([^<\\r\\n]*)`, "i").exec(block);
  return m ? m[1].trim() : undefined;
}

export function parseOFX(text: string): StatementTx[] {
  const out: StatementTx[] = [];
  const re = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|(?=<\/BANKTRANLIST>))/gi;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text))) {
    const b = m[1];
    const dt = (tag(b, "DTPOSTED") ?? "").slice(0, 8);
    const date = dt.length === 8 ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}` : "";
    const raw = (tag(b, "TRNAMT") ?? "").replace(/\s/g, "");
    // aceita 1234.56, -1234.56 e 1234,56
    const amount = Number(raw.includes(",") && !raw.includes(".") ? raw.replace(",", ".") : raw.replace(/,/g, ""));
    if (!isValidISO(date) || !Number.isFinite(amount) || amount === 0) continue;
    const memo = [tag(b, "NAME"), tag(b, "MEMO")].filter(Boolean).join(" — ") || "Lançamento";
    out.push({ id: tag(b, "FITID") || `tx${++n}`, date, amount: Math.round(amount * 100) / 100, memo });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export interface StatementMatch {
  tx: StatementTx;
  kind: "pagar" | "receber";
  targetId: string;
  label: string;
  /** Dias entre o vencimento e a data do extrato. */
  gap: number;
}

export interface StatementResult {
  matches: StatementMatch[];
  /** Movimentos sem conta correspondente na Luma. */
  unmatched: StatementTx[];
}

/** Janela de dias entre vencimento e pagamento para considerar a mesma conta. */
export const MATCH_WINDOW = 10;

export function matchStatement(txs: StatementTx[], bills: Bill[], receivables: Receivable[]): StatementResult {
  const usedB = new Set<string>();
  const usedR = new Set<string>();
  const matches: StatementMatch[] = [];
  const unmatched: StatementTx[] = [];
  for (const tx of txs) {
    const value = Math.abs(tx.amount);
    if (tx.amount < 0) {
      const c = bills
        .filter((b) => !b.paidAt && !usedB.has(b.id) && Math.abs(b.amount - value) < 0.01 && Math.abs(diffDays(b.dueDate, tx.date)) <= MATCH_WINDOW)
        .sort((a, b) => Math.abs(diffDays(a.dueDate, tx.date)) - Math.abs(diffDays(b.dueDate, tx.date)))[0];
      if (c) {
        usedB.add(c.id);
        matches.push({ tx, kind: "pagar", targetId: c.id, label: `${c.supplier} — ${c.description}`, gap: diffDays(c.dueDate, tx.date) });
      } else unmatched.push(tx);
    } else {
      const c = receivables
        .filter((r) => !r.receivedAt && !usedR.has(r.id) && Math.abs(r.amount - value) < 0.01 && Math.abs(diffDays(r.dueDate, tx.date)) <= MATCH_WINDOW)
        .sort((a, b) => Math.abs(diffDays(a.dueDate, tx.date)) - Math.abs(diffDays(b.dueDate, tx.date)))[0];
      if (c) {
        usedR.add(c.id);
        matches.push({ tx, kind: "receber", targetId: c.id, label: `${c.customer} — ${c.description}`, gap: diffDays(c.dueDate, tx.date) });
      } else unmatched.push(tx);
    }
  }
  return { matches, unmatched };
}
