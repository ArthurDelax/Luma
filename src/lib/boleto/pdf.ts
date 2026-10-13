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

export async function readPdfTextItems(data: ArrayBuffer, maxPages = 3): Promise<{ items: TextItem[]; pages: number }> {
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
  const pages = Math.min(doc.numPages, maxPages);
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    for (const it of content.items as any[]) {
      if (typeof it.str !== "string") continue;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width ?? 0, page: p });
    }
  }
  const total = doc.numPages as number;
  await task.destroy();
  return { items, pages: total };
}
