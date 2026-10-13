/**
 * Extração de campos de um boleto a partir do texto obtido pelo PDF.js.
 *
 * Os boletos seguem um layout parecido (rótulo pequeno e o valor logo abaixo
 * ou ao lado), mas cada banco tem variações. Por isso a extração é heurística:
 * um campo só é preenchido quando encontramos evidência clara no documento.
 * Nada é inventado — campos não identificados ficam vazios.
 */

import { brDateToISO } from "../dates.ts";
import { isValidCNPJ, onlyDigits, parseBRL } from "../format.ts";
import { bankName } from "./banks.ts";
import { isParseError, parseLinhaDigitavel, type LinhaResult } from "./linha.ts";

export interface TextItem {
  str: string;
  x: number;
  y: number;
  w: number;
  page: number;
}

export type FieldKey =
  | "supplier"
  | "supplierCnpj"
  | "payer"
  | "amount"
  | "dueDate"
  | "digitableLine"
  | "documentNumber"
  | "bank";

export interface ExtractedBoleto {
  supplier?: string;
  supplierCnpj?: string;
  payer?: string;
  amount?: number;
  dueDate?: string;
  digitableLine?: string;
  documentNumber?: string;
  bank?: string;
  linha?: LinhaResult;
  /** Campos encontrados, com a origem da informação. */
  found: Partial<Record<FieldKey, string>>;
  warnings: string[];
  /** Quantidade de caracteres de texto extraídos (0 = provavelmente digitalizado). */
  textLength: number;
}

interface Line {
  page: number;
  y: number;
  items: TextItem[];
  text: string;
}

const LABELS = {
  supplier: [/benefici[aá]rio(?!\s*final)/i, /cedente/i],
  payer: [/pagador/i, /sacado/i],
  dueDate: [/vencimento/i],
  amount: [/valor\s+(do\s+)?documento/i, /\(=\)\s*valor\s+cobrado/i, /valor\s+a\s+pagar/i, /valor\s+total/i],
  documentNumber: [/n[º°o.]*\s*(do\s+)?documento/i, /n[uú]mero\s+do\s+documento/i, /num\.?\s*doc/i],
};

/* ------------------------------------------------------------------ */
/* Organização do texto em linhas                                       */
/* ------------------------------------------------------------------ */

export function buildLines(items: TextItem[]): Line[] {
  const clean = items.filter((i) => i.str.trim().length > 0);
  const sorted = [...clean].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && last.page === it.page && Math.abs(last.y - it.y) <= 2.5) {
      last.items.push(it);
    } else {
      lines.push({ page: it.page, y: it.y, items: [it], text: "" });
    }
  }
  for (const l of lines) {
    l.items.sort((a, b) => a.x - b.x);
    l.text = l.items.map((i) => i.str.trim()).join(" ").replace(/\s+/g, " ");
  }
  return lines;
}

/* ------------------------------------------------------------------ */
/* Linha digitável                                                      */
/* ------------------------------------------------------------------ */

/** Procura no texto sequências numéricas que formem uma linha digitável válida. */
export function findDigitableLine(fullText: string, referenceISO?: string): LinhaResult | undefined {
  const candidates: string[] = [];
  const re = /\d[\d.\s-]{38,80}\d/g;
  for (const m of fullText.matchAll(re)) {
    const digits = onlyDigits(m[0]);
    for (const len of [48, 47, 44]) {
      for (let i = 0; i + len <= digits.length; i++) candidates.push(digits.slice(i, i + len));
    }
  }
  let invalid: LinhaResult | undefined;
  for (const c of candidates) {
    if (c.length === 44 && candidates.some((o) => o.length > 44)) continue;
    const r = parseLinhaDigitavel(c, referenceISO);
    if (isParseError(r)) continue;
    if (r.valid) return r;
  }
  // Nenhuma válida: devolve a primeira sequência com o formato impresso de uma linha
  // digitável, para que o usuário veja o aviso de DV e possa corrigir.
  const printed = [
    /\d{5}[.\s]?\d{5}\s+\d{5}[.\s]?\d{6}\s+\d{5}[.\s]?\d{6}\s+\d\s+\d{14}/,
    /(?:\d{11}[-\s]?\d\s+){3}\d{11}[-\s]?\d/,
  ];
  for (const re2 of printed) {
    const m = fullText.match(re2);
    if (!m) continue;
    const r = parseLinhaDigitavel(onlyDigits(m[0]), referenceISO);
    if (!isParseError(r)) {
      invalid = r;
      break;
    }
  }
  return invalid;
}

/* ------------------------------------------------------------------ */
/* Busca de valores próximos a rótulos                                   */
/* ------------------------------------------------------------------ */

type Matcher = (text: string) => string | undefined;

const dateMatcher: Matcher = (t) => {
  const m = t.match(/\b(\d{2}[/.]\d{2}[/.]\d{4})\b/);
  return m ? m[1] : undefined;
};

const amountMatcher: Matcher = (t) => {
  const m = t.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})(?!\d)/);
  return m ? m[1] : undefined;
};

function stripLabel(text: string, label: RegExp): string {
  return text.replace(label, "").replace(/^[\s:/\-–|]+/, "").trim();
}

/**
 * Retorna os textos "candidatos a valor" de um rótulo: o restante do item do rótulo,
 * os itens à direita na mesma linha e os itens logo abaixo, alinhados horizontalmente.
 */
function valuesNearLabel(lines: Line[], rawLabel: RegExp, below = 2): { sameLine: string[]; below: string[] } {
  // O rótulo precisa estar no início do item (evita casar "Código do Beneficiário",
  // "texto de responsabilidade do beneficiário" etc.).
  const label = new RegExp(`^\\s*(?:\\(\\W\\)\\s*)?(?:${rawLabel.source})`, rawLabel.flags);
  const sameLine: string[] = [];
  const belowVals: string[] = [];
  lines.forEach((line, idx) => {
    line.items.forEach((item, itemIdx) => {
      if (!label.test(item.str)) return;
      const rest = stripLabel(item.str, label);
      if (rest) sameLine.push(rest);
      const right = line.items.slice(itemIdx + 1, itemIdx + 3).map((i) => i.str.trim());
      if (right.length) sameLine.push(right.join(" "));
      const x0 = item.x - 8;
      const x1 = item.x + Math.max(item.w, 60) + 40;
      for (let k = 1; k <= below && idx + k < lines.length; k++) {
        const next = lines[idx + k];
        if (next.page !== line.page) break;
        const aligned = next.items.filter((i) => i.x + i.w >= x0 && i.x <= x1).map((i) => i.str.trim());
        if (aligned.length) belowVals.push(aligned.join(" "));
      }
    });
  });
  return { sameLine, below: belowVals };
}

function findByLabels(lines: Line[], labels: RegExp[], matcher: Matcher): string | undefined {
  for (const label of labels) {
    const { sameLine, below } = valuesNearLabel(lines, label);
    for (const v of [...sameLine, ...below]) {
      const m = matcher(v);
      if (m) return m;
    }
  }
  return undefined;
}

const LABEL_WORDS = /(benefici[aá]rio|cedente|pagador|sacado|vencimento|valor|documento|ag[eê]ncia|c[oó]digo|nosso\s+n[uú]mero|data|esp[eé]cie|aceite|carteira|quantidade|local\s+de\s+pagamento|instru[cç][oõ]es|cpf|cnpj|endere[cç]o|autentica[cç][aã]o)/i;

const CNPJ_RE = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;

function cleanName(text: string): string | undefined {
  let t = text
    .replace(CNPJ_RE, "")
    .replace(/\b(cnpj|cpf)(\/(cnpj|cpf))?\b\s*[:.]?/gi, "")
    .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, "")
    .replace(/[\s\-–:|/]+$/g, "")
    .replace(/^[\s\-–:|/]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length < 3 || !/[a-zA-ZÀ-ú]{3}/.test(t)) return undefined;
  if (LABEL_WORDS.test(t) && t.split(" ").length <= 3) return undefined;
  if (t.length > 90) t = t.slice(0, 90).trim();
  return t;
}

function findParty(lines: Line[], labels: RegExp[]): { name?: string; cnpj?: string } {
  for (const label of labels) {
    const { sameLine, below } = valuesNearLabel(lines, label, 2);
    const candidates = [...sameLine, ...below];
    let name: string | undefined;
    let cnpj: string | undefined;
    for (const c of candidates) {
      if (!cnpj) {
        for (const m of c.matchAll(CNPJ_RE)) {
          if (isValidCNPJ(m[0])) {
            cnpj = onlyDigits(m[0]);
            break;
          }
        }
      }
      if (!name) name = cleanName(c);
      if (name && cnpj) break;
    }
    if (name || cnpj) return { name, cnpj };
  }
  return {};
}

/* ------------------------------------------------------------------ */
/* Extração principal                                                   */
/* ------------------------------------------------------------------ */

export function extractBoleto(items: TextItem[], referenceISO?: string): ExtractedBoleto {
  const lines = buildLines(items);
  const fullText = lines.map((l) => l.text).join("\n");
  const textLength = fullText.replace(/\s/g, "").length;
  const result: ExtractedBoleto = { found: {}, warnings: [], textLength };

  if (textLength < 20) {
    result.warnings.push("O PDF não possui texto extraível. Ele provavelmente é uma imagem digitalizada — preencha os dados manualmente.");
    return result;
  }

  // 1) Linha digitável: a fonte mais confiável de valor, vencimento e banco.
  const linha = findDigitableLine(fullText, referenceISO);
  if (linha) {
    result.linha = linha;
    result.digitableLine = linha.digitable;
    result.found.digitableLine = linha.valid ? "linha digitável (DV conferido)" : "linha digitável (DV não confere)";
    if (!linha.valid) {
      result.warnings.push("Encontramos uma linha digitável, mas os dígitos verificadores não conferem. Confira a linha antes de salvar.");
    }
    if (linha.valid && linha.amount !== undefined) {
      result.amount = linha.amount;
      result.found.amount = "linha digitável";
    }
    if (linha.valid && linha.dueDate) {
      result.dueDate = linha.dueDate;
      result.found.dueDate = "fator de vencimento";
    }
    if (linha.kind === "bancario" && linha.bankCode) {
      const name = bankName(linha.bankCode);
      result.bank = name ? `${linha.bankCode} – ${name}` : linha.bankCode;
      result.found.bank = "código do banco";
    }
  } else {
    result.warnings.push("Não encontramos uma linha digitável no documento.");
  }

  // 2) Vencimento pelo rótulo (prevalece sobre o fator quando ambos existem e divergem).
  const dueText = findByLabels(lines, LABELS.dueDate, dateMatcher);
  const dueFromLabel = dueText ? brDateToISO(dueText) : undefined;
  if (dueFromLabel) {
    if (result.dueDate && result.dueDate !== dueFromLabel) {
      result.warnings.push("O vencimento impresso difere do vencimento codificado na linha digitável. Usamos o impresso — confira.");
    }
    result.dueDate = dueFromLabel;
    result.found.dueDate = "campo Vencimento";
  }

  // 3) Valor pelo rótulo, quando a linha não informa.
  const amountText = findByLabels(lines, LABELS.amount, amountMatcher);
  const amountFromLabel = amountText ? parseBRL(amountText) : undefined;
  if (amountFromLabel !== undefined && amountFromLabel > 0) {
    if (result.amount === undefined) {
      result.amount = amountFromLabel;
      result.found.amount = "campo Valor do Documento";
    } else if (Math.abs(result.amount - amountFromLabel) > 0.009) {
      result.warnings.push("O valor impresso difere do valor da linha digitável. Confira antes de salvar.");
    }
  }

  // 4) Beneficiário e pagador.
  const supplier = findParty(lines, LABELS.supplier);
  if (supplier.name) {
    result.supplier = supplier.name;
    result.found.supplier = "campo Beneficiário";
  }
  if (supplier.cnpj) {
    result.supplierCnpj = supplier.cnpj;
    result.found.supplierCnpj = "campo Beneficiário";
  }
  const payer = findParty(lines, LABELS.payer);
  if (payer.name && payer.name !== result.supplier) {
    result.payer = payer.name;
    result.found.payer = "campo Pagador";
  }

  // 5) Número do documento.
  const docMatcher: Matcher = (t) => {
    const m = t.match(/^\s*([A-Z0-9][A-Z0-9./-]{1,24})\b/i);
    if (!m) return undefined;
    const v = m[1];
    if (/^\d{2}[/.]\d{2}[/.]\d{4}$/.test(v)) return undefined; // é uma data
    if (!/\d/.test(v)) return undefined;
    return v;
  };
  const docNumber = findByLabels(lines, LABELS.documentNumber, docMatcher);
  if (docNumber) {
    result.documentNumber = docNumber;
    result.found.documentNumber = "campo Nº do Documento";
  }

  // 6) Banco pelo cabeçalho "341-7", quando não veio da linha.
  if (!result.bank) {
    const m = fullText.match(/\b(\d{3})-[\dxX]\b/);
    const name = m ? bankName(m[1]) : undefined;
    if (m && name) {
      result.bank = `${m[1]} – ${name}`;
      result.found.bank = "cabeçalho do boleto";
    }
  }

  return result;
}

export const FIELD_LABELS: Record<FieldKey, string> = {
  supplier: "Beneficiário",
  supplierCnpj: "CNPJ do beneficiário",
  payer: "Pagador",
  amount: "Valor",
  dueDate: "Vencimento",
  digitableLine: "Linha digitável",
  documentNumber: "Nº do documento",
  bank: "Banco emissor",
};
