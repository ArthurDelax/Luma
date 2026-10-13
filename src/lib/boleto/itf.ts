/**
 * Leitura do código de barras de boletos e guias (padrão "Intercalado 2 de 5",
 * 44 dígitos) a partir da imagem da página.
 *
 * Usado quando o PDF não tem texto (ex.: guia "impressa em PDF" ou digitalizada):
 * o código de barras traz valor, e em várias guias o vencimento e o número do
 * documento. Só aceitamos uma leitura cujos dígitos verificadores conferem.
 */

import { isParseError, parseLinhaDigitavel } from "./linha.ts";

/** Padrões de cada dígito: 1 = barra/espaço largo, 0 = estreito. */
const PATTERNS: Record<string, string> = {
  "00110": "0",
  "10001": "1",
  "01001": "2",
  "11000": "3",
  "00101": "4",
  "10100": "5",
  "01100": "6",
  "00011": "7",
  "10010": "8",
  "01010": "9",
};

const PAIRS = 22; // 44 dígitos
const RUNS = 4 + PAIRS * 10 + 3; // início + dados + fim

/** Classifica 5 larguras: as 2 maiores são as largas. Retorna o dígito ou null. */
function digitOf(widths: number[]): string | null {
  const order = widths.map((w, i) => [w, i] as const).sort((a, b) => b[0] - a[0]);
  const minWide = order[1][0];
  const maxNarrow = order[2][0];
  if (minWide < maxNarrow * 1.4) return null; // não há distinção clara entre largo e estreito
  const bits = [0, 0, 0, 0, 0];
  bits[order[0][1]] = 1;
  bits[order[1][1]] = 1;
  return PATTERNS[bits.join("")] ?? null;
}

/** Tenta decodificar uma sequência de larguras (barra, espaço, barra, …) começando numa barra. */
function decodeRuns(runs: number[], start: number): string | null {
  if (start + RUNS > runs.length) return null;
  const s = runs.slice(start, start + 4);
  const narrow = (s[0] + s[1] + s[2] + s[3]) / 4;
  if (Math.max(...s) > narrow * 1.8 || Math.min(...s) < narrow * 0.4) return null;
  let digits = "";
  for (let p = 0; p < PAIRS; p++) {
    const base = start + 4 + p * 10;
    const bars = [0, 2, 4, 6, 8].map((k) => runs[base + k]);
    const spaces = [1, 3, 5, 7, 9].map((k) => runs[base + k]);
    // todos os elementos devem ter tamanho compatível com o módulo estreito
    if (Math.min(...bars, ...spaces) < narrow * 0.4 || Math.max(...bars, ...spaces) > narrow * 5) return null;
    const a = digitOf(bars);
    const b = digitOf(spaces);
    if (a === null || b === null) return null;
    digits += a + b;
  }
  const stop = runs.slice(start + 4 + PAIRS * 10, start + RUNS);
  if (stop[0] < narrow * 1.6) return null; // barra larga do final
  return digits;
}

/** Larguras alternadas (começando pela primeira barra escura) de uma linha de pixels. */
export function runsFromRow(dark: (x: number) => boolean, width: number): number[] {
  const runs: number[] = [];
  let x = 0;
  while (x < width && !dark(x)) x++;
  let cur = true;
  let len = 0;
  for (; x < width; x++) {
    const d = dark(x);
    if (d === cur) len++;
    else {
      runs.push(len);
      cur = d;
      len = 1;
    }
  }
  if (len) runs.push(len);
  return runs;
}

/** Procura um código de 44 dígitos válido numa linha (larguras alternadas, começando por barra). */
export function decodeRow(runs: number[]): string | null {
  for (let i = 0; i + RUNS <= runs.length; i += 2) {
    const d = decodeRuns(runs, i);
    if (d && isValidBarcode(d)) return d;
  }
  return null;
}

export function isValidBarcode(d: string): boolean {
  if (!/^\d{44}$/.test(d)) return false;
  const r = parseLinhaDigitavel(d);
  return !isParseError(r) && r.valid;
}

export interface GrayImage {
  width: number;
  height: number;
  /** Luminância 0–255, uma posição por pixel. */
  gray: Uint8Array | Uint8ClampedArray;
}

export function toGray(img: { width: number; height: number; data: Uint8ClampedArray }): GrayImage {
  const gray = new Uint8ClampedArray(img.width * img.height);
  for (let i = 0, j = 0; j < gray.length; i += 4, j++) gray[j] = (img.data[i] * 299 + img.data[i + 1] * 587 + img.data[i + 2] * 114) / 1000;
  return { width: img.width, height: img.height, gray };
}

/** Varre a imagem em linhas horizontais e devolve o primeiro código válido encontrado. */
export function scanImageForBarcode(img: GrayImage, step = 3): string | null {
  for (let y = 0; y < img.height; y += step) {
    const row = y * img.width;
    // pula linhas praticamente brancas
    let darkCount = 0;
    for (let x = 0; x < img.width; x += 4) if (img.gray[row + x] < 128) darkCount++;
    if (darkCount < 40) continue;
    const runs = runsFromRow((x) => img.gray[row + x] < 140, img.width);
    if (runs.length < RUNS) continue;
    const found = decodeRow(runs);
    if (found) return found;
  }
  return null;
}
