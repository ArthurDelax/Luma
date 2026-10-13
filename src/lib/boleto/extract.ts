/**
 * Extração de campos de um boleto a partir do texto obtido pelo PDF.js.
 *
 * Os boletos seguem um layout parecido (rótulo pequeno e o valor logo abaixo
 * ou ao lado), mas cada banco tem variações. Por isso a extração é heurística:
 * um campo só é preenchido quando encontramos evidência clara no documento.
 * Nada é inventado — campos não identificados ficam vazios.
 */

import { brDateToISO } from "../dates.ts";
import { formatCNPJ, isValidCNPJ, onlyDigits, parseBRL } from "../format.ts";
import { bankName } from "./banks.ts";
import { isParseError, parseLinhaDigitavel, type LinhaResult } from "./linha.ts";
import { findPixKeyInText, findPixPayloadInText, namesLookRelated, parsePixPayload, PIX_KEY_TYPE_LABEL, type PixKeyType, type PixPayload } from "./pix.ts";

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
  | "bank"
  | "pixKey"
  | "pixCopiaECola";

export interface ExtractedBoleto {
  supplier?: string;
  supplierCnpj?: string;
  payer?: string;
  amount?: number;
  dueDate?: string;
  digitableLine?: string;
  documentNumber?: string;
  bank?: string;
  /** Sugestões quando o tipo de documento é reconhecido (ex.: guia do FGTS). */
  description?: string;
  category?: string;
  /** Tipo de guia reconhecido (ex.: "FGTS", "DARF"). */
  guide?: string;
  pixKey?: string;
  pixKeyType?: PixKeyType;
  pixCopiaECola?: string;
  pix?: PixPayload;
  linha?: LinhaResult;
  /** Campos encontrados, com a origem da informação. */
  found: Partial<Record<FieldKey, string>>;
  warnings: string[];
  /** Quantidade de caracteres de texto extraídos (0 = provavelmente digitalizado). */
  textLength: number;
  /** O texto veio de reconhecimento de imagem (OCR). */
  ocr?: boolean;
}

interface Line {
  page: number;
  y: number;
  items: TextItem[];
  text: string;
}

const LABELS = {
  supplier: [/benefici[aá]rio(?!\s*final)/i, /cedente/i, /favorecido/i, /recebedor/i],
  payer: [
    /pagador/i,
    /sacado/i,
    /nome\s*\/?\s*raz[ãa]o\s+social(\s+do\s+(empregador|contribuinte))?/i,
    /raz[ãa]o\s+social(\s+do\s+(empregador|contribuinte))?/i,
    /nome\s+do\s+(contribuinte|empregador|cliente)/i,
    /contribuinte/i,
    /empregador/i,
  ],
  payerDocument: [/cpf\s*\/\s*cnpj(\s+do\s+(empregador|contribuinte|pagador))?/i, /cnpj\s*\/\s*cpf/i, /cnpj(\s+do\s+(empregador|contribuinte|pagador))/i],
  dueDate: [
    /data\s+de\s+vencimento/i,
    /vencimento/i,
    /pagar\s+(este\s+documento\s+)?at[ée]/i,
    /pag[áa]vel\s+at[ée]/i,
    /data\s+limite(\s+para\s+pagamento)?/i,
  ],
  amount: [
    /\(=\)\s*valor\s+cobrado/i,
    /valor\s+(do\s+)?documento/i,
    /valor\s+a\s+(pagar|recolher)/i,
    /total\s+a\s+(pagar|recolher)/i,
    /total\s+da\s+guia/i,
    /valor\s+total/i,
    /total\s+do\s+documento/i,
  ],
  documentNumber: [/n[º°o.]*\s*(do\s+)?documento/i, /n[uú]mero\s+do\s+documento/i, /num\.?\s*doc/i],
};

/* ------------------------------------------------------------------ */
/* Guias de tributos e encargos                                         */
/* ------------------------------------------------------------------ */

interface GuideTemplate {
  id: string;
  match: RegExp;
  name: string;
  supplier: string;
  category: string;
  /** Rótulo do número/identificador da guia. */
  idLabels?: RegExp[];
  /** Rótulo da competência / período de apuração. */
  periodLabels?: RegExp[];
}

/**
 * Guias oficiais reconhecidas pelo título impresso. O destinatário é inferido do
 * próprio tipo de guia (ex.: GFD → FGTS/Caixa), e o usuário pode corrigir.
 */
const GUIDES: GuideTemplate[] = [
  { id: "fgts", match: /guia\s+do\s+fgts\s+digital|\bGFD\b/i, name: "FGTS", supplier: "FGTS Digital (Caixa Econômica Federal)", category: "Folha e encargos", idLabels: [/identificador/i], periodLabels: [/compet[êe]ncia/i] },
  { id: "das", match: /documento\s+de\s+arrecada[çc][ãa]o\s+do\s+simples\s+nacional|\bDAS\b.*simples/i, name: "DAS — Simples Nacional", supplier: "Receita Federal (Simples Nacional)", category: "Impostos e taxas", idLabels: [/n[uú]mero\s+do\s+documento/i], periodLabels: [/per[íi]odo\s+de\s+apura[çc][ãa]o/i, /compet[êe]ncia/i] },
  { id: "dae", match: /documento\s+de\s+arrecada[çc][ãa]o\s+do\s+e-?social/i, name: "DAE — eSocial", supplier: "Receita Federal (eSocial)", category: "Folha e encargos", idLabels: [/n[uú]mero\s+do\s+documento/i], periodLabels: [/per[íi]odo\s+de\s+apura[çc][ãa]o/i, /compet[êe]ncia/i] },
  { id: "darf", match: /documento\s+de\s+arrecada[çc][ãa]o\s+de\s+receitas\s+federais|\bDARF\b/i, name: "DARF", supplier: "Receita Federal", category: "Impostos e taxas", idLabels: [/n[uú]mero\s+do\s+documento/i], periodLabels: [/per[íi]odo\s+de\s+apura[çc][ãa]o/i, /compet[êe]ncia/i] },
  { id: "gps", match: /guia\s+da\s+previd[êe]ncia\s+social/i, name: "GPS — INSS", supplier: "INSS (Previdência Social)", category: "Folha e encargos", periodLabels: [/compet[êe]ncia/i] },
  { id: "gru", match: /guia\s+de\s+recolhimento\s+da\s+uni[ãa]o/i, name: "GRU", supplier: "Tesouro Nacional (GRU)", category: "Impostos e taxas", idLabels: [/n[uú]mero\s+de\s+refer[êe]ncia/i] },
];

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const periodMatcher = (t: string) => {
  const byName = t.match(/\b(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(?:\/|de)\s*(\d{4})\b/i);
  if (byName) {
    const m = MONTHS.indexOf(byName[1].toLowerCase().replace("marco", "março")) + 1;
    return `${String(m).padStart(2, "0")}/${byName[2]}`;
  }
  return t.match(/\b(\d{2}\/\d{4})\b/)?.[1] ?? t.match(/\b(\d{2}\/\d{2}\/\d{4})\b/)?.[1];
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
export function findDigitableLine(fullText: string, referenceISO?: string, excludeDigits = ""): LinhaResult | undefined {
  const candidates: string[] = [];
  const re = /\d[\d.\s-]{38,80}\d/g;
  for (const m of fullText.matchAll(re)) {
    const digits = onlyDigits(m[0]);
    for (const len of [48, 47, 44]) {
      for (let i = 0; i + len <= digits.length; i++) {
        const c = digits.slice(i, i + len);
        // ignora números que fazem parte do código Pix Copia e Cola
        if (excludeDigits && excludeDigits.includes(c)) continue;
        candidates.push(c);
      }
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

/** Linha lida do código de barras da imagem (só aceita leitura com DV conferido). */
function linhaFromBarcodes(barcodes: string[] | undefined, referenceISO?: string): LinhaResult | undefined {
  for (const b of barcodes ?? []) {
    const r = parseLinhaDigitavel(b, referenceISO);
    if (!isParseError(r) && r.valid) return r;
  }
  return undefined;
}

/** Preenche valor, vencimento, banco e nº do documento a partir da linha/código de barras. */
function applyLinha(result: ExtractedBoleto, linha: LinhaResult, source: "linha digitável" | "código de barras") {
  result.linha = linha;
  result.digitableLine = linha.digitable;
  result.found.digitableLine = linha.valid ? `${source} (DV conferido)` : `${source} (DV não confere)`;
  if (!linha.valid) {
    result.warnings.push("Encontramos uma linha digitável, mas os dígitos verificadores não conferem. Confira a linha antes de salvar.");
  }
  if (linha.valid && linha.amount !== undefined) {
    result.amount = linha.amount;
    result.found.amount = source;
  }
  if (linha.valid && linha.dueDate) {
    result.dueDate = linha.dueDate;
    result.found.dueDate = linha.kind === "bancario" ? "fator de vencimento" : `${source} (${linha.agency ?? "guia"})`;
  }
  if (linha.valid && linha.documentNumber && !result.documentNumber) {
    result.documentNumber = linha.documentNumber;
    result.found.documentNumber = source;
  }
  if (linha.kind === "bancario" && linha.bankCode) {
    const name = bankName(linha.bankCode);
    result.bank = name ? `${linha.bankCode} – ${name}` : linha.bankCode;
    result.found.bank = "código do banco";
  }
}

/** Guia da Receita Federal reconhecida só pelo código de barras (PDF sem texto). */
function applyAgencyGuide(result: ExtractedBoleto) {
  if (result.guide || result.linha?.agency !== "Receita Federal") return;
  const darf = GUIDES.find((g) => g.id === "darf")!;
  result.guide = darf.name;
  result.category = darf.category;
  result.description = darf.name;
  if (!result.supplier) {
    result.supplier = darf.supplier;
    result.found.supplier = "código de barras (Receita Federal)";
  }
}

export function extractBoleto(
  items: TextItem[],
  referenceISO?: string,
  extras: { qrCodes?: string[]; barcodes?: string[]; ocrItems?: TextItem[]; ocrItemsAlt?: TextItem[][] } = {},
): ExtractedBoleto {
  // PDF em imagem: usa o texto reconhecido por OCR como se fosse o texto do PDF.
  const ownText = items.map((i) => i.str).join("").replace(/\s/g, "").length;
  if (ownText < 20 && extras.ocrItems && extras.ocrItems.map((i) => i.str).join("").replace(/\s/g, "").length >= 20) {
    const r = extractBoleto(extras.ocrItems, referenceISO, { qrCodes: extras.qrCodes, barcodes: extras.barcodes });
    const alts = (extras.ocrItemsAlt ?? []).map((a) => extractBoleto(a, referenceISO, { qrCodes: extras.qrCodes, barcodes: extras.barcodes }));
    // OCR pode trocar dígitos (ex.: 2026 → 2020): fica com um vencimento plausível entre as leituras.
    const plausible = (iso?: string) => {
      if (!iso) return false;
      const ref = referenceISO ? new Date(referenceISO).getTime() : Date.now();
      const days = (new Date(iso).getTime() - ref) / 86_400_000;
      return days > -400 && days < 400;
    };
    if (!plausible(r.dueDate) && r.found.dueDate !== "código de barras (Receita Federal)") {
      const better = alts.find((a) => plausible(a.dueDate)) ?? (r.dueDate ? undefined : alts.find((a) => a.dueDate));
      if (better) {
        r.dueDate = better.dueDate;
        r.found.dueDate = better.found.dueDate;
      }
      if (r.dueDate && !plausible(r.dueDate)) {
        // erro típico de OCR no último dígito do ano: usa o ano de referência (ou o seguinte)
        const refISO = referenceISO ?? new Date().toISOString().slice(0, 10);
        const refYear = Number(refISO.slice(0, 4));
        let fixed = `${refYear}${r.dueDate.slice(4)}`;
        if ((new Date(fixed).getTime() - new Date(refISO).getTime()) / 86_400_000 < -200) fixed = `${refYear + 1}${r.dueDate.slice(4)}`;
        const original = r.dueDate.split("-").reverse().join("/");
        r.dueDate = fixed;
        r.warnings.push(`O ano do vencimento lido (${original}) parecia errado e foi ajustado para ${fixed.split("-").reverse().join("/")} — confira a data.`);
      }
    }
    for (const alt of alts) {
      // completa o que faltou com as leituras extras
      for (const k of ["dueDate", "amount", "payer", "documentNumber", "supplierCnpj"] as const) {
        if (r[k] === undefined && alt[k] !== undefined) {
          (r as unknown as Record<string, unknown>)[k] = alt[k];
          if (alt.found[k]) r.found[k] = alt.found[k];
        }
      }
      if (!r.linha?.valid && alt.linha?.valid) {
        r.linha = alt.linha;
        r.digitableLine = alt.digitableLine;
        r.found.digitableLine = alt.found.digitableLine;
      }
    }
    r.ocr = true;
    r.warnings.unshift("O PDF é uma imagem: lemos o texto por reconhecimento de imagem (OCR). Confira valor e vencimento antes de salvar.");
    return r;
  }
  const lines = buildLines(items);
  const fullText = lines.map((l) => l.text).join("\n");
  // versão sem separadores entre trechos da mesma linha (códigos longos vêm fatiados)
  const tightText = lines.map((l) => l.items.map((i) => i.str).join("")).join("\n");
  const textLength = fullText.replace(/\s/g, "").length;
  const result: ExtractedBoleto = { found: {}, warnings: [], textLength };

  if (textLength < 20) {
    const fromImage = linhaFromBarcodes(extras.barcodes, referenceISO);
    if (fromImage) {
      applyLinha(result, fromImage, "código de barras");
      applyAgencyGuide(result);
    }
    applyPix(result, "", "", extras.qrCodes ?? []);
    const read = [fromImage && "o código de barras", result.pix && "o QR Code Pix"].filter(Boolean).join(" e ");
    result.warnings.unshift(
      read
        ? `O PDF não possui texto (é uma imagem). Lemos ${read}${fromImage?.dueDate ? "" : " — confira o vencimento"}; preencha o que faltar.`
        : "O PDF não possui texto extraível. Ele provavelmente é uma imagem digitalizada — preencha os dados manualmente.",
    );
    return result;
  }

  // 1) Linha digitável: a fonte mais confiável de valor, vencimento e banco.
  const pixInText = findPixPayloadInText([tightText, fullText]);
  const textLinha = findDigitableLine(fullText, referenceISO, pixInText ? onlyDigits(pixInText.raw) : "");
  const imageLinha = textLinha?.valid ? undefined : linhaFromBarcodes(extras.barcodes, referenceISO);
  if (imageLinha) applyLinha(result, imageLinha, "código de barras");
  else if (textLinha) applyLinha(result, textLinha, "linha digitável");
  else {
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
    result.found.dueDate = "campo de vencimento";
  }

  // 3) Valor pelo rótulo, quando a linha não informa.
  const amountText = findByLabels(lines, LABELS.amount, amountMatcher);
  const amountFromLabel = amountText ? parseBRL(amountText) : undefined;
  if (amountFromLabel !== undefined && amountFromLabel > 0) {
    if (result.amount === undefined) {
      result.amount = amountFromLabel;
      result.found.amount = "campo de valor";
    } else if (Math.abs(result.amount - amountFromLabel) > 0.009) {
      result.warnings.push("O valor impresso difere do valor da linha digitável. Confira antes de salvar.");
    }
  }

  // 3b) Últimos recursos quando os rótulos não foram reconhecidos (layouts fora do padrão).
  if (!result.dueDate) {
    const near = fullText.match(/venc[a-zçã.]*[^\n\d]{0,40}?(\d{2}\/\d{2}\/\d{4})/i)?.[1];
    const dates = Array.from(new Set(Array.from(fullText.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g), (m) => m[1])));
    const pick = near ?? (dates.length === 1 ? dates[0] : undefined);
    const iso = pick ? brDateToISO(pick) : undefined;
    if (iso) {
      result.dueDate = iso;
      result.found.dueDate = near ? "data próxima de “vencimento”" : "única data do documento";
      result.warnings.push("Confira o vencimento: ele foi identificado por aproximação.");
    }
  }
  if (result.amount === undefined) {
    const values = Array.from(fullText.matchAll(/R\$\s*([\d.]+,\d{2})\b/g), (m) => parseBRL(m[1])).filter((v): v is number => v !== undefined && v > 0);
    if (values.length) {
      result.amount = Math.max(...values);
      result.found.amount = "maior valor em R$ do documento";
      result.warnings.push("Confira o valor: ele foi identificado por aproximação (maior valor em R$ do documento).");
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
    const docText = findByLabels(lines, LABELS.payerDocument, (t) => t.match(/\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}(?:\/?\d{4}-?\d{2})?)\b/)?.[1]);
    const payerDoc = payer.cnpj ? formatCNPJ(payer.cnpj) : docText;
    result.payer = payerDoc ? `${payer.name} — ${onlyDigits(payerDoc).length === 11 ? "CPF" : "CNPJ"} ${payerDoc}` : payer.name;
    result.found.payer = "campo Pagador / Contribuinte";
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

  // 7) Guias de tributos e encargos (FGTS, DAS, DARF…).
  const guide = GUIDES.find((g) => g.match.test(fullText));
  if (guide) {
    result.guide = guide.name;
    result.category = guide.category;
    if (!result.supplier) {
      result.supplier = guide.supplier;
      result.found.supplier = `tipo de guia (${guide.name})`;
    }
    const period = guide.periodLabels ? findByLabels(lines, guide.periodLabels, periodMatcher) : undefined;
    result.description = period ? `${guide.name} — competência ${period}` : guide.name;
    if (guide.idLabels && !result.linha?.documentNumber) {
      const id = findByLabels(lines, guide.idLabels, docMatcher);
      if (id) {
        result.documentNumber = id;
        result.found.documentNumber = "identificador da guia";
      }
    }
    const i = result.warnings.indexOf("Não encontramos uma linha digitável no documento.");
    if (i >= 0) result.warnings.splice(i, 1); // guias pagas por Pix podem não ter linha digitável
  }

  applyAgencyGuide(result);
  applyPix(result, fullText, tightText, extras.qrCodes ?? []);
  if (!result.linha && result.pix) {
    const i = result.warnings.indexOf("Não encontramos uma linha digitável no documento.");
    if (i >= 0) result.warnings[i] = "Não encontramos linha digitável — o documento parece ser uma cobrança via Pix.";
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* Pix                                                                  */
/* ------------------------------------------------------------------ */

function applyPix(result: ExtractedBoleto, fullText: string, tightText: string, qrCodes: string[]) {
  // 1) QR Code (mais confiável), 2) código copia e cola impresso no texto.
  let payload: PixPayload | undefined;
  let source = "";
  for (const q of qrCodes) {
    const p = parsePixPayload(q);
    if (p && (!payload || (p.crcValid && !payload.crcValid))) {
      payload = p;
      source = "QR Code Pix";
    }
  }
  if (!payload && (fullText || tightText)) {
    payload = findPixPayloadInText([tightText, fullText]);
    if (payload) source = "Pix Copia e Cola impresso";
  }

  if (payload) {
    result.pix = payload;
    result.pixCopiaECola = payload.raw;
    result.found.pixCopiaECola = payload.crcValid ? `${source} (CRC conferido)` : `${source} (CRC não confere)`;
    if (!payload.crcValid) {
      result.warnings.push("O código Pix encontrado está com o dígito de controle (CRC) incorreto. Confira antes de usar.");
    }
    if (payload.key) {
      result.pixKey = payload.key;
      result.pixKeyType = payload.keyType;
      result.found.pixKey = source;
    }
    if (payload.crcValid && payload.amount !== undefined) {
      if (result.amount === undefined) {
        result.amount = payload.amount;
        result.found.amount = source;
      } else if (Math.abs(result.amount - payload.amount) > 0.009) {
        result.warnings.push("O valor do Pix é diferente do valor do boleto. Confira antes de pagar.");
      }
    }
    if (payload.merchantName) {
      if (!result.supplier) {
        result.supplier = payload.merchantName;
        result.found.supplier = "recebedor do Pix";
      } else if (!namesLookRelated(result.supplier, payload.merchantName)) {
        result.warnings.push(
          `O recebedor do Pix ("${payload.merchantName}") não parece ser o beneficiário do boleto ("${result.supplier}"). Confirme com o fornecedor antes de pagar.`,
        );
      }
    }
  }

  // Chave escrita no documento ("Chave Pix: ...") quando o código não trouxe uma.
  if (!result.pixKey && fullText) {
    const k = findPixKeyInText(fullText);
    if (k) {
      result.pixKey = k.key;
      result.pixKeyType = k.type;
      result.found.pixKey = `campo Chave Pix (${PIX_KEY_TYPE_LABEL[k.type]})`;
    }
  }
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
  pixKey: "Chave Pix",
  pixCopiaECola: "Pix Copia e Cola",
};
