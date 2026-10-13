/**
 * Leitura de PDF no navegador com PDF.js.
 *
 * Os arquivos do PDF.js são servidos estaticamente em /pdfjs (copiados de
 * node_modules no build) e carregados sob demanda — só quando o usuário
 * importa um boleto. Nenhum arquivo é enviado para servidores.
 */

import { BASE_PATH } from "../paths.ts";
import type { TextItem } from "./extract.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type PdfJs = any;

let loader: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  if (!loader) {
    const url = `${window.location.origin}${BASE_PATH}/pdfjs/pdf.min.mjs`;
    loader = import(/* webpackIgnore: true */ /* @vite-ignore */ url).then((lib: PdfJs) => {
      lib.GlobalWorkerOptions.workerSrc = `${window.location.origin}${BASE_PATH}/pdfjs/pdf.worker.min.mjs`;
      return lib;
    });
    loader.catch(() => {
      loader = null;
    });
  }
  return loader;
}

export class PdfReadError extends Error {
  code: "encrypted" | "invalid" | "load" | "too_large";
  constructor(code: PdfReadError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export const MAX_PDF_BYTES = 15 * 1024 * 1024;

export interface PdfReadResult {
  items: TextItem[];
  pages: number;
  /** Conteúdo dos QR Codes encontrados nas páginas (ex.: Pix Copia e Cola). */
  qrCodes: string[];
}

/* ---------------- QR Code ---------------- */

type QrDecoder = (img: ImageData) => Promise<string | null>;
let qrDecoder: Promise<QrDecoder> | null = null;

/** Usa o BarcodeDetector nativo quando existir; senão, a biblioteca jsQR (carregada sob demanda). */
function getQrDecoder(): Promise<QrDecoder> {
  if (!qrDecoder) {
    qrDecoder = (async () => {
      const BD = (globalThis as any).BarcodeDetector;
      let native: any = null;
      try {
        if (BD && (await BD.getSupportedFormats?.())?.includes("qr_code")) native = new BD({ formats: ["qr_code"] });
      } catch {
        native = null;
      }
      const { default: jsQR } = await import("jsqr");
      return async (img: ImageData) => {
        if (native) {
          try {
            const found = await native.detect(img);
            if (found?.[0]?.rawValue) return String(found[0].rawValue);
          } catch {
            /* cai para o jsQR */
          }
        }
        return jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
      };
    })();
    qrDecoder.catch(() => {
      qrDecoder = null;
    });
  }
  return qrDecoder;
}

async function renderPage(page: PdfJs, scale: number): Promise<ImageData | null> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Procura QR Codes na página: primeiro na página inteira, depois em faixas (QR pequenos). */
async function scanPageForQr(page: PdfJs, decode: QrDecoder): Promise<string | null> {
  for (const scale of [2.5]) {
    const img = await renderPage(page, scale);
    if (!img) return null;
    const whole = await decode(img);
    if (whole) return whole;
    // faixas sobrepostas de 40% da altura: ajuda quando o QR é pequeno em relação à página
    const band = Math.floor(img.height * 0.4);
    for (let y = 0; y + band <= img.height; y += Math.floor(band / 2)) {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = band;
      const cx = c.getContext("2d", { willReadFrequently: true });
      if (!cx) break;
      cx.putImageData(img, 0, -y);
      const found = await decode(cx.getImageData(0, 0, img.width, band));
      if (found) return found;
    }
  }
  return null;
}

export async function readPdf(data: ArrayBuffer, maxPages = 3, options: { scanQr?: boolean } = {}): Promise<PdfReadResult> {
  if (data.byteLength > MAX_PDF_BYTES) {
    throw new PdfReadError("too_large", "O arquivo é maior que 15 MB.");
  }
  let lib: PdfJs;
  try {
    lib = await loadPdfJs();
  } catch {
    throw new PdfReadError("load", "Não foi possível carregar o leitor de PDF. Verifique sua conexão e tente novamente.");
  }
  const base = `${window.location.origin}${BASE_PATH}/pdfjs/`;
  let doc: PdfJs;
  let task: PdfJs;
  try {
    task = lib.getDocument({
      data: new Uint8Array(data),
      cMapUrl: `${base}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${base}standard_fonts/`,
      wasmUrl: `${base}wasm/`,
      enableXfa: false,
    });
    doc = await task.promise;
  } catch (err: any) {
    const name = String(err?.name ?? "");
    if (name === "PasswordException") {
      throw new PdfReadError("encrypted", "O PDF está protegido por senha.");
    }
    throw new PdfReadError("invalid", "O arquivo não parece ser um PDF válido ou está corrompido.");
  }

  const items: TextItem[] = [];
  const qrCodes: string[] = [];
  const pages = Math.min(doc.numPages, maxPages);
  let decode: QrDecoder | null = null;
  if (options.scanQr !== false) {
    try {
      decode = await getQrDecoder();
    } catch {
      decode = null; // sem leitor de QR: segue só com o texto
    }
  }
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    for (const it of content.items as any[]) {
      if (typeof it.str !== "string") continue;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width ?? 0, page: p });
    }
    if (decode && qrCodes.length === 0 && p <= 2) {
      try {
        const qr = await scanPageForQr(page, decode);
        if (qr) qrCodes.push(qr);
      } catch {
        /* falha ao renderizar a página: ignora o QR */
      }
    }
  }
  const total = doc.numPages as number;
  await task.destroy();
  return { items, pages: total, qrCodes };
}
