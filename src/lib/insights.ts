/**
 * Checagens inteligentes sobre uma conta, comparando com o histórico da empresa:
 *  - Boleto suspeito: o mesmo fornecedor passou a cobrar por outro banco, outro
 *    CNPJ ou outra chave Pix (sinal comum de boleto adulterado).
 *  - Conta que subiu: valor bem acima da média das últimas contas do mesmo
 *    fornecedor ou da mesma despesa recorrente.
 *
 * São avisos para a pessoa conferir — nunca uma garantia de fraude ou de erro.
 * Funções puras, sem React, fáceis de testar.
 */

import { parsePixPayload } from "./boleto/pix.ts";
import { normalizeText, onlyDigits } from "./format.ts";
import type { Bill } from "./types.ts";

export interface RiskSignal {
  kind: "cnpj" | "banco" | "pix";
  /** Frase curta para a pessoa ler. */
  message: string;
}

export interface AmountJump {
  /** Média das contas anteriores consideradas. */
  average: number;
  /** Aumento em relação à média (0.34 = 34%). */
  increase: number;
  /** Quantas contas anteriores entraram na média. */
  basedOn: number;
}

type BillLike = Partial<Bill>;

/** Código de 3 dígitos do banco emissor (só boletos bancários). */
export function bankCodeOf(b: BillLike): string | undefined {
  const line = onlyDigits(b.digitableLine);
  // boleto bancário: 47 dígitos e não começa com 8 (8 = arrecadação: concessionárias e tributos)
  if (line.length === 47 && line[0] !== "8") return line.slice(0, 3);
  const m = /^\s*(\d{3})\b/.exec(b.bank ?? "");
  return m ? m[1] : undefined;
}

/** Nome do banco para exibir ("341 – Itaú" → "Itaú"; sem nome → "banco 341"). */
function bankLabel(b: BillLike, code: string): string {
  const name = (b.bank ?? "").replace(/^\s*\d{3}\s*[–-]?\s*/, "").trim();
  return name || `banco ${code}`;
}

/** Chave Pix de quem recebe (campo próprio ou dentro do Pix Copia e Cola estático). */
export function pixKeyOf(b: BillLike): string | undefined {
  const k = b.pixKey?.trim() || (b.pixCopiaECola ? parsePixPayload(b.pixCopiaECola)?.key : undefined);
  return k ? k.toLowerCase() : undefined;
}

function sameSupplier(a: BillLike, b: BillLike): boolean {
  const na = normalizeText(a.supplier);
  return !!na && na === normalizeText(b.supplier);
}

function sameCnpj(a: BillLike, b: BillLike): boolean {
  const ca = onlyDigits(a.supplierCnpj);
  return ca.length === 14 && ca === onlyDigits(b.supplierCnpj);
}

function plural(n: number, um: string, varios: string) {
  return n === 1 ? um : varios;
}

/**
 * Sinais de que o boleto pode ter sido adulterado, comparando com as contas
 * anteriores do mesmo fornecedor. Só avisa quando há histórico para comparar.
 */
export function riskSignals(candidate: BillLike, bills: Bill[]): RiskSignal[] {
  const others = bills.filter((b) => b.id !== candidate.id);
  const byName = others.filter((b) => sameSupplier(candidate, b));
  const history = others.filter((b) => sameSupplier(candidate, b) || sameCnpj(candidate, b));
  if (!history.length) return [];
  const supplier = candidate.supplier?.trim() || byName[0]?.supplier || history[0].supplier;
  const signals: RiskSignal[] = [];

  // 1) mesmo nome de fornecedor, CNPJ diferente
  const cnpj = onlyDigits(candidate.supplierCnpj);
  if (cnpj.length === 14) {
    const known = new Set(byName.map((b) => onlyDigits(b.supplierCnpj)).filter((c) => c.length === 14));
    if (known.size && !known.has(cnpj)) {
      signals.push({ kind: "cnpj", message: `O CNPJ do beneficiário é diferente do usado nas contas anteriores de ${supplier}.` });
    }
  }

  // 2) banco emissor diferente do habitual
  const code = bankCodeOf(candidate);
  if (code) {
    const prev = history.map((b) => ({ b, c: bankCodeOf(b) })).filter((x): x is { b: Bill; c: string } => !!x.c);
    const codes = new Set(prev.map((x) => x.c));
    if (codes.size && !codes.has(code)) {
      const usual = prev[prev.length - 1];
      const n = prev.length;
      signals.push({
        kind: "banco",
        message: `${supplier} ${plural(n, "cobrou", "sempre cobrou")} pelo ${bankLabel(usual.b, usual.c)} (${n} ${plural(n, "conta anterior", "contas anteriores")}), e este boleto é do ${bankLabel(candidate, code)}.`,
      });
    }
  }

  // 3) chave Pix diferente
  const key = pixKeyOf(candidate);
  if (key) {
    const keys = new Set(history.map(pixKeyOf).filter((k): k is string => !!k));
    if (keys.size && !keys.has(key)) {
      signals.push({ kind: "pix", message: `A chave Pix deste boleto é diferente da usada nas contas anteriores de ${supplier}.` });
    }
  }
  return signals;
}

/** Aumento mínimo para avisar (20%) e diferença mínima em reais (evita avisos por centavos). */
export const JUMP_MIN_INCREASE = 0.2;
export const JUMP_MIN_DIFF = 30;

/**
 * Compara o valor com a média das últimas 3 contas anteriores (pelo vencimento)
 * do mesmo fornecedor ou da mesma despesa recorrente. Precisa de pelo menos 2
 * contas anteriores para a média fazer sentido.
 */
export function amountJump(candidate: BillLike, bills: Bill[]): AmountJump | undefined {
  if (!candidate.amount || candidate.amount <= 0 || !candidate.dueDate) return undefined;
  const prev = bills
    .filter(
      (b) =>
        b.id !== candidate.id &&
        b.dueDate < candidate.dueDate! &&
        b.amount > 0 &&
        ((candidate.recurringId && b.recurringId === candidate.recurringId) || sameSupplier(candidate, b) || sameCnpj(candidate, b)),
    )
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    .slice(0, 3);
  if (prev.length < 2) return undefined;
  const average = prev.reduce((s, b) => s + b.amount, 0) / prev.length;
  const diff = candidate.amount - average;
  const increase = diff / average;
  if (increase < JUMP_MIN_INCREASE || diff < JUMP_MIN_DIFF) return undefined;
  return { average, increase, basedOn: prev.length };
}

/** "34%" — arredonda para inteiro. */
export function percentText(x: number): string {
  return `${Math.round(x * 100)}%`;
}
