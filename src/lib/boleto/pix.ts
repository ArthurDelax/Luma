/**
 * Pix: chave e "Pix Copia e Cola" (BR Code / EMV-QRCPS do Banco Central).
 *
 * Boletos híbridos trazem um QR Code Pix, e muitos PDFs também imprimem a
 * chave Pix ou o código "copia e cola". Aqui:
 *  - validamos o código copia e cola pelo CRC16 (campo 63);
 *  - lemos chave, valor, nome e cidade do recebedor e o identificador (txid);
 *  - reconhecemos chaves Pix soltas no texto (CPF, CNPJ, e-mail, celular, aleatória).
 *
 * Um CRC correto só indica que o código não foi corrompido — não que a cobrança
 * seja legítima.
 */

import { isValidCNPJ, onlyDigits } from "../format.ts";

export type PixKeyType = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";

export const PIX_KEY_TYPE_LABEL: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  telefone: "Celular",
  aleatoria: "Chave aleatória",
};

export interface PixPayload {
  /** Código completo, sem espaços. */
  raw: string;
  crcValid: boolean;
  /** Chave Pix (QR estático). */
  key?: string;
  keyType?: PixKeyType;
  /** URL do payload (QR dinâmico — a chave fica no servidor do banco). */
  url?: string;
  dynamic: boolean;
  amount?: number;
  merchantName?: string;
  merchantCity?: string;
  txid?: string;
  description?: string;
}

/* ------------------------------------------------------------------ */
/* CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF)                 */
/* ------------------------------------------------------------------ */

export function crc16(payload: string): string {
  let crc = 0xffff;
  const bytes = new TextEncoder().encode(payload);
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/* ------------------------------------------------------------------ */
/* TLV                                                                  */
/* ------------------------------------------------------------------ */

interface Tlv {
  id: string;
  value: string;
}

function parseTlv(s: string): Tlv[] | null {
  const out: Tlv[] = [];
  let i = 0;
  while (i < s.length) {
    if (i + 4 > s.length) return null;
    const id = s.slice(i, i + 2);
    const len = Number(s.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(id) || !Number.isInteger(len)) return null;
    const value = s.slice(i + 4, i + 4 + len);
    if (value.length !== len) return null;
    out.push({ id, value });
    i += 4 + len;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Chaves                                                               */
/* ------------------------------------------------------------------ */

export function isValidCPF(input: string): boolean {
  const c = onlyDigits(input);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(c[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[a-z]{2,}$/i;

/** Identifica o tipo de uma chave Pix. Retorna undefined se não for uma chave válida. */
export function classifyPixKey(raw: string): { key: string; type: PixKeyType } | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  if (UUID_RE.test(t)) return { key: t.toLowerCase(), type: "aleatoria" };
  if (EMAIL_RE.test(t)) return { key: t.toLowerCase(), type: "email" };
  if (/^\+55\d{10,11}$/.test(t.replace(/[\s()-]/g, ""))) return { key: t.replace(/[\s()-]/g, ""), type: "telefone" };
  const d = onlyDigits(t);
  if (/^[\d.\-/\s]+$/.test(t)) {
    if (d.length === 14 && isValidCNPJ(d)) return { key: d, type: "cnpj" };
    if (d.length === 11 && isValidCPF(d)) return { key: d, type: "cpf" };
  }
  return undefined;
}

export function formatPixKey(key: string, type?: PixKeyType): string {
  const t = type ?? classifyPixKey(key)?.type;
  if (t === "cpf") return key.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (t === "cnpj") return key.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (t === "telefone") return key.replace(/^\+55(\d{2})(\d{4,5})(\d{4})$/, "+55 ($1) $2-$3");
  return key;
}

/* ------------------------------------------------------------------ */
/* Copia e cola                                                         */
/* ------------------------------------------------------------------ */

/** Interpreta um código Pix Copia e Cola. Retorna undefined se não for um BR Code Pix. */
export function parsePixPayload(input: string): PixPayload | undefined {
  // Quebras de linha são removidas; espaços são mantidos (o nome do recebedor pode ter espaços).
  const raw = input.replace(/[\r\n\t]+/g, "").trim();
  if (!raw.startsWith("000201")) return undefined;
  const fields = parseTlv(raw);
  if (!fields) return undefined;
  const get = (id: string) => fields.find((f) => f.id === id)?.value;

  // Conta do recebedor: qualquer campo 26–51 com o GUI do Pix.
  let account: Tlv[] | null = null;
  for (const f of fields) {
    const n = Number(f.id);
    if (n >= 26 && n <= 51) {
      const sub = parseTlv(f.value);
      if (sub?.some((s) => s.id === "00" && s.value.toLowerCase() === "br.gov.bcb.pix")) {
        account = sub;
        break;
      }
    }
  }
  if (!account) return undefined;

  const crcField = raw.lastIndexOf("6304");
  const crcValid = crcField >= 0 && crcField + 8 === raw.length && crc16(raw.slice(0, crcField + 4)) === raw.slice(crcField + 4).toUpperCase();

  const keyRaw = account.find((s) => s.id === "01")?.value;
  const url = account.find((s) => s.id === "25")?.value;
  const description = account.find((s) => s.id === "02")?.value;
  const classified = keyRaw ? classifyPixKey(keyRaw) : undefined;
  const amountStr = get("54");
  const amount = amountStr && /^\d+(\.\d{1,2})?$/.test(amountStr) ? Number(amountStr) : undefined;
  const additional = get("62");
  const txid = additional ? parseTlv(additional)?.find((s) => s.id === "05")?.value : undefined;

  return {
    raw,
    crcValid,
    key: classified?.key ?? keyRaw,
    keyType: classified?.type,
    url,
    dynamic: !!url,
    amount: amount && amount > 0 ? amount : undefined,
    merchantName: get("59")?.trim() || undefined,
    merchantCity: get("60")?.trim() || undefined,
    txid: txid && txid !== "***" ? txid : undefined,
    description: description || undefined,
  };
}

/**
 * Procura um código Pix Copia e Cola em uma ou mais versões do texto do PDF
 * (o código costuma vir quebrado em várias linhas). Prefere o que tiver CRC válido.
 */
export function findPixPayloadInText(texts: string | string[]): PixPayload | undefined {
  const variants = (Array.isArray(texts) ? texts : [texts]).flatMap((t) => [t.replace(/[\r\n]+/g, ""), t.replace(/\s+/g, "")]);
  let fallback: PixPayload | undefined;
  for (const compact of variants) {
    let from = 0;
    for (let guard = 0; guard < 20; guard++) {
      const start = compact.indexOf("000201", from);
      if (start < 0) break;
      let end = compact.indexOf("6304", start);
      while (end > 0 && end - start < 600) {
        const candidate = compact.slice(start, end + 8);
        if (/6304[0-9A-Fa-f]{4}$/.test(candidate)) {
          const p = parsePixPayload(candidate);
          if (p?.crcValid) return p;
          if (p && !fallback) fallback = p;
        }
        end = compact.indexOf("6304", end + 1);
      }
      from = start + 6;
    }
  }
  return fallback;
}

/** Procura uma chave Pix escrita junto a um rótulo como "Chave Pix:". */
export function findPixKeyInText(text: string): { key: string; type: PixKeyType } | undefined {
  const re = /chave\s*pix\s*(?:\((?:cpf|cnpj|e-?mail|celular|telefone|aleat[óo]ria|evp)\))?\s*[:\-–]?\s*([^\n]{3,80})/gi;
  for (const m of text.matchAll(re)) {
    const after = m[1].trim();
    // tenta o trecho inteiro e depois cada "palavra"
    const tries = [after, ...after.split(/\s+/), after.replace(/\s+/g, "")];
    for (const t of tries) {
      const k = classifyPixKey(t.replace(/[.,;]$/, ""));
      if (k) return k;
    }
  }
  return undefined;
}

/** Nomes "compatíveis": o nome do Pix (até 25 letras) aparece no beneficiário, ou o contrário. */
export function namesLookRelated(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\b(ltda|me|epp|eireli|s\/?a|sa|cia|de|da|do|dos|das|e)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wa = new Set(na.split(" ").filter((w) => w.length >= 3));
  return nb.split(" ").some((w) => w.length >= 3 && wa.has(w));
}

/** Gera um BR Code estático válido (usado nos testes e PDFs de exemplo). */
export function buildPixPayload(opts: { key: string; name: string; city: string; amount?: number; txid?: string }): string {
  const f = (id: string, v: string) => id + String(v.length).padStart(2, "0") + v;
  const account = f("00", "br.gov.bcb.pix") + f("01", opts.key);
  let s = f("00", "01") + f("26", account) + f("52", "0000") + f("53", "986");
  if (opts.amount) s += f("54", opts.amount.toFixed(2));
  s += f("58", "BR") + f("59", opts.name.slice(0, 25)) + f("60", opts.city.slice(0, 15)) + f("62", f("05", opts.txid ?? "***"));
  s += "6304";
  return s + crc16(s);
}
