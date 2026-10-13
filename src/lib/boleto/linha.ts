/**
 * Validação e interpretação de linha digitável / código de barras de boletos
 * segundo as especificações FEBRABAN.
 *
 * Dois formatos são suportados:
 *
 * 1. Boleto bancário (cobrança) — linha digitável com 47 dígitos,
 *    código de barras com 44 dígitos. Campos 1, 2 e 3 usam DV módulo 10;
 *    o DV geral do código de barras usa módulo 11.
 *
 * 2. Documento de arrecadação (contas de consumo, tributos, convênios) —
 *    começa com "8", linha digitável com 48 dígitos (4 blocos de 11 + DV).
 *    O 3º dígito (identificador de valor) define o módulo: 6 ou 7 → módulo 10;
 *    8 ou 9 → módulo 11.
 *
 * IMPORTANTE: uma linha com dígitos verificadores corretos NÃO garante que o
 * boleto seja legítimo. A validação apenas detecta erros de digitação/leitura.
 */

import { addDays, isValidISO } from "../dates.ts";

export type BoletoKind = "bancario" | "arrecadacao";

export interface FieldCheck {
  label: string;
  valid: boolean;
}

export interface LinhaResult {
  kind: BoletoKind;
  /** Linha digitável normalizada (apenas dígitos). */
  digitable: string;
  /** Código de barras (44 dígitos). */
  barcode: string;
  /** Todos os dígitos verificadores conferem. */
  valid: boolean;
  checks: FieldCheck[];
  /** Valor em reais, quando codificado na linha (undefined = não informado/valor livre). */
  amount?: number;
  /** Vencimento derivado do fator de vencimento (apenas boletos bancários). */
  dueDate?: string;
  /** Código do banco (bancário) ou segmento (arrecadação). */
  bankCode?: string;
  segment?: string;
  /** Observações técnicas (ex.: valor é referência, não reais). */
  notes: string[];
}

const digitsOnly = (s: string) => s.replace(/\D/g, "");

/** Módulo 10 (pesos 2,1 da direita para a esquerda, somando os dígitos dos produtos). */
export function mod10(num: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    let p = Number(num[i]) * weight;
    if (p > 9) p = Math.floor(p / 10) + (p % 10);
    sum += p;
    weight = weight === 2 ? 1 : 2;
  }
  return (10 - (sum % 10)) % 10;
}

function mod11Sum(num: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    sum += Number(num[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  return sum;
}

/** Módulo 11 do DV geral do boleto bancário: resultados 0, 10 e 11 viram 1. */
export function mod11Bancario(num: string): number {
  const dv = 11 - (mod11Sum(num) % 11);
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv;
}

/** Módulo 11 da arrecadação: restos 0 e 1 geram DV 0; resto 10 gera DV 1. */
export function mod11Arrecadacao(num: string): number {
  const r = mod11Sum(num) % 11;
  if (r === 0 || r === 1) return 0;
  if (r === 10) return 1;
  return 11 - r;
}

/* ------------------------------------------------------------------ */
/* Fator de vencimento                                                  */
/* ------------------------------------------------------------------ */

/**
 * O fator de vencimento conta dias a partir de 07/10/1997. Ao atingir 9999
 * (21/02/2025), ele reinicia em 1000 a partir de 22/02/2025. Como um mesmo
 * fator pode representar duas datas, escolhemos a mais próxima da data de
 * referência (normalmente hoje).
 */
export function dueDateFromFactor(factor: number, referenceISO?: string): string | undefined {
  if (!Number.isFinite(factor) || factor < 1000) return undefined;
  const oldCycle = addDays("1997-10-07", factor);
  const newCycle = addDays("2025-02-22", factor - 1000);
  const ref = referenceISO && isValidISO(referenceISO) ? referenceISO : new Date().toISOString().slice(0, 10);
  const dist = (iso: string) => Math.abs(new Date(iso).getTime() - new Date(ref).getTime());
  return dist(newCycle) <= dist(oldCycle) ? newCycle : oldCycle;
}

/** Calcula o fator de vencimento (ciclo atual) para uma data. Usado em testes e dados de exemplo. */
export function factorFromDueDate(iso: string): number {
  const ms = new Date(iso).getTime();
  const oldBase = new Date("1997-10-07").getTime();
  const newBase = new Date("2025-02-22").getTime();
  if (ms >= newBase) return 1000 + Math.round((ms - newBase) / 86_400_000);
  return Math.round((ms - oldBase) / 86_400_000);
}

/* ------------------------------------------------------------------ */
/* Boleto bancário                                                      */
/* ------------------------------------------------------------------ */

function bancarioBarcodeFromLinha(l: string): string {
  return l.slice(0, 4) + l.slice(32, 33) + l.slice(33, 47) + l.slice(4, 9) + l.slice(10, 20) + l.slice(21, 31);
}

function bancarioLinhaFromBarcode(b: string): string {
  const f1 = b.slice(0, 4) + b.slice(19, 24);
  const f2 = b.slice(24, 34);
  const f3 = b.slice(34, 44);
  return f1 + mod10(f1) + f2 + mod10(f2) + f3 + mod10(f3) + b.slice(4, 5) + b.slice(5, 19);
}

function analyzeBancario(linha: string, referenceISO?: string): LinhaResult {
  const barcode = bancarioBarcodeFromLinha(linha);
  const checks: FieldCheck[] = [
    { label: "Campo 1", valid: mod10(linha.slice(0, 9)) === Number(linha[9]) },
    { label: "Campo 2", valid: mod10(linha.slice(10, 20)) === Number(linha[20]) },
    { label: "Campo 3", valid: mod10(linha.slice(21, 31)) === Number(linha[31]) },
    { label: "DV geral", valid: mod11Bancario(barcode.slice(0, 4) + barcode.slice(5)) === Number(barcode[4]) },
  ];
  const notes: string[] = [];
  const factor = Number(linha.slice(33, 37));
  const cents = Number(linha.slice(37, 47));
  const dueDate = factor === 0 ? undefined : dueDateFromFactor(factor, referenceISO);
  if (factor === 0) notes.push("Boleto sem vencimento codificado (fator 0000).");
  if (cents === 0) notes.push("Valor não codificado na linha (valor livre).");
  if (linha[3] !== "9") notes.push("Moeda diferente de Real (código 9).");
  return {
    kind: "bancario",
    digitable: linha,
    barcode,
    valid: checks.every((c) => c.valid),
    checks,
    amount: cents > 0 ? cents / 100 : undefined,
    dueDate,
    bankCode: linha.slice(0, 3),
    notes,
  };
}

/* ------------------------------------------------------------------ */
/* Arrecadação                                                          */
/* ------------------------------------------------------------------ */

function arrecadacaoMod(valueId: string): ((n: string) => number) | undefined {
  if (valueId === "6" || valueId === "7") return mod10;
  if (valueId === "8" || valueId === "9") return mod11Arrecadacao;
  return undefined;
}

function analyzeArrecadacaoBarcode(barcode: string, digitable: string, blockChecks: FieldCheck[]): LinhaResult {
  const valueId = barcode[2];
  const mod = arrecadacaoMod(valueId);
  const notes: string[] = [];
  const checks = [...blockChecks];
  if (!mod) {
    checks.push({ label: "Identificador de valor", valid: false });
    notes.push("Identificador de valor inválido (3º dígito deve ser 6, 7, 8 ou 9).");
  } else {
    checks.push({ label: "DV geral", valid: mod(barcode.slice(0, 3) + barcode.slice(4)) === Number(barcode[3]) });
  }
  let amount: number | undefined;
  if (valueId === "6" || valueId === "8") {
    const cents = Number(barcode.slice(4, 15));
    amount = cents > 0 ? cents / 100 : undefined;
  } else if (valueId === "7" || valueId === "9") {
    notes.push("O valor deste documento é uma referência (quantidade/moeda), não um valor em reais.");
  }
  notes.push("Documentos de arrecadação não codificam o vencimento de forma padronizada.");
  return {
    kind: "arrecadacao",
    digitable,
    barcode,
    valid: checks.every((c) => c.valid),
    checks,
    amount,
    segment: barcode[1],
    notes,
  };
}

function analyzeArrecadacaoLinha(linha: string): LinhaResult {
  const blocks = [0, 1, 2, 3].map((i) => linha.slice(i * 12, i * 12 + 12));
  const barcode = blocks.map((b) => b.slice(0, 11)).join("");
  const mod = arrecadacaoMod(barcode[2]);
  const blockChecks: FieldCheck[] = blocks.map((b, i) => ({
    label: `Bloco ${i + 1}`,
    valid: mod ? mod(b.slice(0, 11)) === Number(b[11]) : false,
  }));
  return analyzeArrecadacaoBarcode(barcode, linha, blockChecks);
}

function arrecadacaoLinhaFromBarcode(barcode: string): string {
  const mod = arrecadacaoMod(barcode[2]) ?? mod10;
  return [0, 1, 2, 3].map((i) => {
    const part = barcode.slice(i * 11, i * 11 + 11);
    return part + mod(part);
  }).join("");
}

/* ------------------------------------------------------------------ */
/* API pública                                                          */
/* ------------------------------------------------------------------ */

export type ParseError = { error: string };

/**
 * Analisa uma linha digitável (47 ou 48 dígitos) ou código de barras (44 dígitos).
 * Aceita texto com pontos, espaços e traços.
 */
export function parseLinhaDigitavel(input: string, referenceISO?: string): LinhaResult | ParseError {
  const d = digitsOnly(input);
  if (d.length === 0) return { error: "Informe a linha digitável." };
  if (d.length === 47) {
    if (d[0] === "8") return { error: "Linhas iniciadas em 8 são de arrecadação e devem ter 48 dígitos." };
    return analyzeBancario(d, referenceISO);
  }
  if (d.length === 48) {
    if (d[0] !== "8") return { error: "Linha com 48 dígitos deve começar com 8 (arrecadação)." };
    return analyzeArrecadacaoLinha(d);
  }
  if (d.length === 44) {
    if (d[0] === "8") return analyzeArrecadacaoBarcode(d, arrecadacaoLinhaFromBarcode(d), []);
    return analyzeBancario(bancarioLinhaFromBarcode(d), referenceISO);
  }
  return { error: `A linha possui ${d.length} dígitos. Boletos bancários têm 47 dígitos e contas de arrecadação têm 48.` };
}

export function isParseError(r: LinhaResult | ParseError): r is ParseError {
  return "error" in r;
}

/** Formata a linha para exibição, no padrão impresso nos boletos. */
export function formatLinha(digits: string): string {
  const d = digitsOnly(digits);
  if (d.length === 47) {
    return `${d.slice(0, 5)}.${d.slice(5, 10)} ${d.slice(10, 15)}.${d.slice(15, 21)} ${d.slice(21, 26)}.${d.slice(26, 32)} ${d[32]} ${d.slice(33)}`;
  }
  if (d.length === 48) {
    return [0, 1, 2, 3].map((i) => `${d.slice(i * 12, i * 12 + 11)}-${d[i * 12 + 11]}`).join(" ");
  }
  return d;
}

/**
 * Gera uma linha digitável bancária válida (usada nos dados de exemplo e nos testes).
 * O campo livre é arbitrário — não corresponde a nenhum boleto real.
 */
export function buildBancarioLinha(bank: string, dueISO: string | undefined, amount: number, campoLivre: string): string {
  const factor = dueISO ? String(factorFromDueDate(dueISO)).padStart(4, "0") : "0000";
  const value = String(Math.round(amount * 100)).padStart(10, "0");
  const free = campoLivre.padStart(25, "0").slice(-25);
  const partial = bank.padStart(3, "0") + "9" + factor + value + free;
  const dv = mod11Bancario(partial);
  const barcode = partial.slice(0, 4) + dv + partial.slice(4);
  return bancarioLinhaFromBarcode(barcode);
}

/** Gera uma linha de arrecadação válida (testes). */
export function buildArrecadacaoLinha(segment: string, valueId: "6" | "7" | "8" | "9", amount: number, rest: string): string {
  const value = String(Math.round(amount * 100)).padStart(11, "0");
  const tail = rest.padStart(29, "0").slice(-29);
  const partial = "8" + segment + valueId + value + tail; // 43 dígitos
  const mod = arrecadacaoMod(valueId)!;
  const dv = mod(partial);
  const barcode = partial.slice(0, 3) + dv + partial.slice(3);
  return arrecadacaoLinhaFromBarcode(barcode);
}
