/**
 * Persistência local da demonstração.
 *
 * O restante do app conversa apenas com a interface `DataRepository`.
 * Quando houver backend, basta criar outra implementação (ex.: ApiRepository)
 * sem alterar as telas.
 */

import type { LumaData } from "./types.ts";

export interface DataRepository {
  load(): LumaData | null;
  save(data: LumaData): void;
  clear(): void;
}

export const STORAGE_KEY = "luma:data:v1";

export class StorageError extends Error {}

export class LocalStorageRepository implements DataRepository {
  constructor(private key = STORAGE_KEY) {}

  load(): LumaData | null {
    try {
      const raw = window.localStorage.getItem(this.key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as LumaData;
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.bills)) return null;
      return {
        version: 1,
        bills: parsed.bills ?? [],
        recurring: parsed.recurring ?? [],
        documents: parsed.documents ?? [],
        categories: parsed.categories ?? [],
        receivables: parsed.receivables ?? [],
        cash: parsed.cash,
        readAlerts: parsed.readAlerts ?? [],
        seededAt: parsed.seededAt,
      };
    } catch {
      return null;
    }
  }

  save(data: LumaData): void {
    try {
      window.localStorage.setItem(this.key, JSON.stringify(data));
    } catch {
      throw new StorageError("Não foi possível salvar os dados neste navegador (armazenamento cheio ou bloqueado).");
    }
  }

  clear(): void {
    try {
      window.localStorage.removeItem(this.key);
    } catch {
      /* ignorado */
    }
  }
}

/** Repositório só em memória: usado pela demonstração pública (nada é gravado). */
export class MemoryRepository implements DataRepository {
  private data: LumaData | null = null;
  load(): LumaData | null {
    return this.data;
  }
  save(data: LumaData): void {
    this.data = data;
  }
  clear(): void {
    this.data = null;
  }
}

/** Valida um backup importado pelo usuário. */
export function parseBackup(text: string): LumaData {
  const parsed = JSON.parse(text);
  const data = parsed?.data ?? parsed;
  if (!data || data.version !== 1 || !Array.isArray(data.bills) || !Array.isArray(data.recurring) || !Array.isArray(data.documents)) {
    throw new Error("Arquivo de backup inválido ou de outra versão.");
  }
  // anexos não fazem parte do backup (ficam no IndexedDB)
  const strip = <T extends { attachment?: unknown }>(x: T): T => ({ ...x, attachment: undefined });
  return {
    version: 1,
    bills: data.bills.map(strip),
    recurring: data.recurring,
    documents: data.documents.map(strip),
    categories: Array.isArray(data.categories) ? data.categories : [],
    receivables: Array.isArray(data.receivables) ? data.receivables : [],
    cash: data.cash && typeof data.cash.balance === "number" ? data.cash : undefined,
    readAlerts: Array.isArray(data.readAlerts) ? data.readAlerts : [],
    seededAt: data.seededAt,
  };
}
