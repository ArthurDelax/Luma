/**
 * Anexos (PDF) guardados no IndexedDB do próprio navegador.
 *
 * O localStorage tem limite de poucos MB, insuficiente para PDFs. O IndexedDB
 * comporta arquivos maiores, mas continua sendo local: os anexos existem apenas
 * neste navegador e são perdidos se os dados do site forem apagados.
 */

import { uid } from "./format.ts";
import type { AttachmentMeta } from "./types.ts";

/** Onde os anexos ficam quando o app está ligado a uma empresa na nuvem. */
export interface AttachmentBackend {
  saveAttachment(file: Blob, name: string): Promise<AttachmentMeta>;
  getAttachment(id: string): Promise<Blob | undefined>;
  deleteAttachment(id: string): Promise<void>;
}

let backend: AttachmentBackend | null = null;
export function setAttachmentBackend(b: AttachmentBackend | null) {
  backend = b;
}

const DB_NAME = "luma-anexos";
const STORE = "files";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponível"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Falha ao abrir IndexedDB"));
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

export async function saveAttachment(file: Blob, name: string): Promise<AttachmentMeta> {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("O anexo excede 10 MB.");
  if (backend) return backend.saveAttachment(file, name);
  const id = uid("anx_");
  await tx("readwrite", (s) => s.put(file, id));
  return { id, name, size: file.size, type: file.type || "application/pdf", addedAt: new Date().toISOString() };
}

export async function getAttachment(id: string): Promise<Blob | undefined> {
  if (backend) return backend.getAttachment(id);
  try {
    return (await tx<Blob | undefined>("readonly", (s) => s.get(id) as IDBRequest<Blob | undefined>)) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function deleteAttachment(id: string): Promise<void> {
  if (backend) return backend.deleteAttachment(id);
  try {
    await tx("readwrite", (s) => s.delete(id));
  } catch {
    /* ignorado */
  }
}

export async function clearAttachments(): Promise<void> {
  if (backend) return; // na nuvem, cada anexo é apagado junto com seu registro
  try {
    await tx("readwrite", (s) => s.clear());
  } catch {
    /* ignorado */
  }
}

/** Abre o anexo em uma nova aba. Retorna false se o arquivo não existir mais. */
export async function openAttachment(meta: AttachmentMeta): Promise<boolean> {
  const blob = await getAttachment(meta.id);
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "noopener");
  if (!w) {
    const a = document.createElement("a");
    a.href = url;
    a.download = meta.name;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
