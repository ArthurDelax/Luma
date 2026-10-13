/**
 * Leitura de PDF no navegador com PDF.js.
 *
 * Os arquivos do PDF.js são servidos estaticamente em /pdfjs (copiados de
 * node_modules no build) e carregados sob demanda — só quando o usuário
 * importa um boleto. Nenhum arquivo é enviado para servidores.
 */

import { BASE_PATH } from "../paths.ts";
import { buildLines, findDigitableLine, type TextItem } from "./extract.ts";
import { scanImageForBarcode, toGray } from "./itf.ts";

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
/** Tempo máximo procurando QR Code por página — a leitura do texto nunca fica travada. */
const QR_TIMEOUT_MS = 12_000;

export interface PdfReadResult {
  items: TextItem[];
  pages: number;
  /** Conteúdo dos QR Codes encontrados nas páginas (ex.: Pix Copia e Cola). */
  qrCodes: string[];
  /** Códigos de barras (44 dígitos, DV conferido) lidos da imagem da página. */
  barcodes: string[];
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
  // intent "print": renderiza sem requestAnimationFrame, então funciona mesmo com a aba em segundo plano.
  await page.render({ canvasContext: ctx, canvas, viewport, intent: "print" }).promise;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Procura QR Codes na imagem da página: primeiro inteira, depois em faixas (QR pequenos). */
async function scanImageForQr(img: ImageData, decode: QrDecoder): Promise<string | null> {
  {
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

export async function readPdf(data: ArrayBuffer, maxPages = 3, options: { scanQr?: boolean; scanImage?: boolean } = {}): Promise<PdfReadResult> {
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
  const barcodes: string[] = [];
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
    const pageItems: TextItem[] = [];
    for (const it of content.items as any[]) {
      if (typeof it.str !== "string") continue;
      pageItems.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width ?? 0, page: p });
    }
    items.push(...pageItems);
    if (p > 2 || options.scanImage === false) continue;

    // O que ainda falta e só pode vir da imagem da página:
    //  - código de barras, quando o texto não traz uma linha digitável válida
    //    (PDF sem texto, texto embaralhado pela fonte, linha cortada…);
    //  - QR Code Pix, quando o documento fala em Pix ou não tem texto.
    const text = buildLines(items).map((l) => l.text).join("\n");
    const hasText = text.replace(/\s/g, "").length >= 20;
    const needBarcode = barcodes.length === 0 && !findDigitableLine(text)?.valid;
    const wantQr = !!decode && qrCodes.length === 0 && (!hasText || /pix|qr\s*code/i.test(text));
    if (!needBarcode && !wantQr) continue;
    try {
      const deadline = Date.now() + QR_TIMEOUT_MS;
      const timeout = () => new Promise<null>((r) => setTimeout(() => r(null), Math.max(0, deadline - Date.now())));
      for (const scale of [2.5, 4.2]) {
        const needBc = needBarcode && barcodes.length === 0;
        const needQr = wantQr && qrCodes.length === 0;
        if ((!needBc && !needQr) || Date.now() > deadline) break;
        const img = await Promise.race([renderPage(page, scale), timeout()]);
        if (!img) break;
        if (needBc) {
          const bc = scanImageForBarcode(toGray(img));
          if (bc) barcodes.push(bc);
        }
        if (needQr && decode) {
          const qr = await Promise.race([scanImageForQr(img, decode), timeout()]);
          if (qr) qrCodes.push(qr);
        }
      }
    } catch {
      /* falha ao renderizar a página: segue só com o texto */
    }
  }
  const total = doc.numPages as number;
  await task.destroy();
  return { items, pages: total, qrCodes, barcodes };
}
