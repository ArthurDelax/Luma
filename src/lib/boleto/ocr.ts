/**
 * Reconhecimento de texto (OCR) para PDFs que são só imagem — por exemplo,
 * guias "impressas em PDF" (Microsoft Print to PDF) ou digitalizadas.
 *
 * Usa o Tesseract (WebAssembly) num Web Worker, com os arquivos servidos pelo
 * próprio site em /ocr. O documento nunca sai do navegador do usuário.
 */

import { BASE_PATH } from "../paths.ts";
import type { TextItem } from "./extract.ts";
import type { GrayImage } from "./itf.ts";

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (tsv: string) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(`${BASE_PATH}/ocr/ocr-worker.js`);
    worker.onmessage = (e: MessageEvent<{ id: number; tsv?: string; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.error !== undefined) p.reject(new Error(e.data.error));
      else p.resolve(e.data.tsv ?? "");
    };
    worker.onerror = () => {
      for (const p of pending.values()) p.reject(new Error("Falha no reconhecimento de texto"));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

/**
 * Converte o TSV do Tesseract em itens de texto no mesmo formato do PDF.js (y para cima).
 * Palavras próximas da mesma linha viram um único trecho (como "Pagar este documento até"),
 * para que os rótulos sejam reconhecidos; colunas separadas continuam em trechos diferentes.
 */
export function tsvToItems(tsv: string, img: { width: number; height: number }, scale: number, page: number): TextItem[] {
  interface Word { key: string; text: string; left: number; top: number; width: number; height: number }
  const words: Word[] = [];
  for (const line of tsv.split("\n")) {
    const c = line.split("\t");
    if (c.length < 12 || c[0] !== "5") continue; // nível 5 = palavra
    // bordas de caixas viram "|", "(" etc. no OCR: descarta
    const text = c.slice(11).join("\t").trim().replace(/^[|[\](){}]+|[|[\](){}]+$/g, "");
    const conf = Number(c[10]);
    if (!text || conf < 20 || /^[|_—–\-.,:;'"`~]+$/.test(text)) continue;
    words.push({ key: `${c[2]}.${c[3]}.${c[4]}`, text, left: Number(c[6]), top: Number(c[7]), width: Number(c[8]), height: Number(c[9]) });
  }
  const groups: Word[][] = [];
  for (const w of words) {
    const g = groups[groups.length - 1];
    const last = g?.[g.length - 1];
    const gap = last ? w.left - (last.left + last.width) : Infinity;
    const h = last ? Math.max(last.height, w.height) : 0;
    if (last && last.key === w.key && gap >= -2 && gap <= h * 1.3) g.push(w);
    else groups.push([w]);
  }
  return groups.map((g) => {
    const left = Math.min(...g.map((w) => w.left));
    const right = Math.max(...g.map((w) => w.left + w.width));
    const bottom = Math.max(...g.map((w) => w.top + w.height));
    return {
      str: g.map((w) => w.text).join(" "),
      x: left / scale,
      y: (img.height - bottom) / scale,
      w: (right - left) / scale,
      page,
    };
  });
}

/** Reconhece o texto de uma página renderizada. `scale` = pixels por ponto do PDF. */
/**
 * Inverte as regiões de fundo escuro (texto branco em caixa escura, comum em
 * "valor" e "vencimento" de guias), para que fiquem como texto escuro em fundo claro.
 */
export function normalizeDarkBoxes(img: GrayImage, radius = 40): GrayImage {
  const { width: w, height: h, gray } = img;
  const W = w + 1;
  const integral = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      integral[(y + 1) * W + x + 1] = integral[y * W + x + 1] + row;
    }
  }
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(h, y + radius + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w, x + radius + 1);
      const sum = integral[y1 * W + x1] - integral[y0 * W + x1] - integral[y1 * W + x0] + integral[y0 * W + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      const v = gray[y * w + x];
      out[y * w + x] = mean < 128 ? 255 - v : v;
    }
  }
  return { width: w, height: h, gray: out };
}

/** `psm`: modo de segmentação do Tesseract (6 = bloco único, padrão da biblioteca; 11 = texto esparso, bom para formulários). */
export function ocrPage(img: GrayImage, scale: number, page: number, psm = 6, timeoutMs = 45_000): Promise<TextItem[]> {
  const id = ++seq;
  const w = getWorker();
  const gray = new Uint8Array(img.gray); // cópia transferível
  return new Promise<TextItem[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Tempo esgotado no reconhecimento de texto"));
    }, timeoutMs);
    pending.set(id, {
      resolve: (tsv) => {
        clearTimeout(timer);
        resolve(tsvToItems(tsv, img, scale, page));
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });
    w.postMessage({ id, base: `${window.location.origin}${BASE_PATH}/ocr/`, width: img.width, height: img.height, gray, psm }, [gray.buffer]);
  });
}
