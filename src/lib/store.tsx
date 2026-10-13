"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { clearAttachments, deleteAttachment } from "./attachments.ts";
import { todayISO } from "./dates.ts";
import { DEMO_MODE } from "./demo.ts";
import { uid } from "./format.ts";
import { createSeedData } from "./seed.ts";
import { LocalStorageRepository, MemoryRepository, StorageError, type DataRepository } from "./storage.ts";
import type { Bill, BusinessDocument, LumaData, RecurringExpense } from "./types.ts";

type NewBill = Omit<Bill, "id" | "createdAt" | "updatedAt">;
type NewRecurring = Omit<RecurringExpense, "id" | "createdAt" | "updatedAt">;
type NewDocument = Omit<BusinessDocument, "id" | "createdAt" | "updatedAt">;

interface StoreValue {
  ready: boolean;
  data: LumaData;
  today: string;
  storageError: string | null;
  /** Demonstração pública: nenhuma alteração é permitida. */
  readOnly: boolean;
  /**
   * Verifica se alterações são permitidas. Na demonstração, registra a tentativa
   * (abrindo o aviso para assinantes) e retorna false.
   */
  requireWrite(): boolean;
  /** Momento da última tentativa bloqueada (usado para exibir o aviso). */
  blockedAt: number | null;
  dismissBlocked(): void;
  addBill(b: NewBill): Bill | null;
  updateBill(id: string, patch: Partial<Bill>): void;
  deleteBill(id: string): void;
  markPaid(id: string, paidAt?: string): void;
  reopenBill(id: string): void;
  addRecurring(r: NewRecurring): RecurringExpense | null;
  updateRecurring(id: string, patch: Partial<RecurringExpense>): void;
  deleteRecurring(id: string): void;
  addDocument(d: NewDocument): BusinessDocument | null;
  updateDocument(id: string, patch: Partial<BusinessDocument>): void;
  deleteDocument(id: string): void;
  /** Marcar alertas como lidos é permitido na demonstração (fica só na memória da página). */
  markAlertsRead(ids: string[]): void;
  resetToSample(): Promise<void>;
  clearAll(): Promise<void>;
  replaceAll(data: LumaData): void;
}

const empty: LumaData = { version: 1, bills: [], recurring: [], documents: [], readAlerts: [] };

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children, repository, readOnly = DEMO_MODE }: { children: ReactNode; repository?: DataRepository; readOnly?: boolean }) {
  // Na demonstração os dados vivem só na memória: sempre os mesmos dados fictícios, nada é gravado.
  const repo = useMemo(() => repository ?? (readOnly ? new MemoryRepository() : new LocalStorageRepository()), [repository, readOnly]);
  const [data, setData] = useState<LumaData>(empty);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [today, setToday] = useState(todayISO());
  const [blockedAt, setBlockedAt] = useState<number | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    const stored = repo.load();
    setData(stored ?? createSeedData(todayISO()));
    loaded.current = true;
    setReady(true);
  }, [repo]);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      repo.save(data);
      setStorageError(null);
    } catch (e) {
      setStorageError(e instanceof StorageError ? e.message : "Falha ao salvar os dados.");
    }
  }, [data, repo]);

  useEffect(() => {
    const t = setInterval(() => setToday(todayISO()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (readOnly) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("luma:")) {
        const fresh = repo.load();
        if (fresh) setData(fresh);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [repo, readOnly]);

  /** Guarda única de escrita: toda alteração de dados passa por aqui. */
  const requireWrite = useCallback(() => {
    if (!readOnly) return true;
    setBlockedAt(Date.now());
    return false;
  }, [readOnly]);

  const dismissBlocked = useCallback(() => setBlockedAt(null), []);

  const stamp = () => new Date().toISOString();

  const addBill = useCallback(
    (b: NewBill) => {
      if (!requireWrite()) return null;
      const bill: Bill = { ...b, id: uid("cta_"), createdAt: stamp(), updatedAt: stamp() };
      setData((d) => ({ ...d, bills: [...d.bills, bill] }));
      return bill;
    },
    [requireWrite],
  );

  const updateBill = useCallback(
    (id: string, patch: Partial<Bill>) => {
      if (!requireWrite()) return;
      setData((d) => ({ ...d, bills: d.bills.map((b) => (b.id === id ? { ...b, ...patch, id, updatedAt: stamp() } : b)) }));
    },
    [requireWrite],
  );

  const deleteBill = useCallback(
    (id: string) => {
      if (!requireWrite()) return;
      setData((d) => {
        const bill = d.bills.find((b) => b.id === id);
        if (bill?.attachment) void deleteAttachment(bill.attachment.id);
        return { ...d, bills: d.bills.filter((b) => b.id !== id) };
      });
    },
    [requireWrite],
  );

  const markPaid = useCallback(
    (id: string, paidAt?: string) => {
      if (!requireWrite()) return;
      setData((d) => ({ ...d, bills: d.bills.map((b) => (b.id === id ? { ...b, paidAt: paidAt ?? todayISO(), updatedAt: stamp() } : b)) }));
    },
    [requireWrite],
  );

  const reopenBill = useCallback(
    (id: string) => {
      if (!requireWrite()) return;
      setData((d) => ({ ...d, bills: d.bills.map((b) => (b.id === id ? { ...b, paidAt: undefined, updatedAt: stamp() } : b)) }));
    },
    [requireWrite],
  );

  const addRecurring = useCallback(
    (r: NewRecurring) => {
      if (!requireWrite()) return null;
      const rec: RecurringExpense = { ...r, id: uid("rec_"), createdAt: stamp(), updatedAt: stamp() };
      setData((d) => ({ ...d, recurring: [...d.recurring, rec] }));
      return rec;
    },
    [requireWrite],
  );

  const updateRecurring = useCallback(
    (id: string, patch: Partial<RecurringExpense>) => {
      if (!requireWrite()) return;
      setData((d) => ({ ...d, recurring: d.recurring.map((r) => (r.id === id ? { ...r, ...patch, id, updatedAt: stamp() } : r)) }));
    },
    [requireWrite],
  );

  const deleteRecurring = useCallback(
    (id: string) => {
      if (!requireWrite()) return;
      setData((d) => ({
        ...d,
        recurring: d.recurring.filter((r) => r.id !== id),
        bills: d.bills.map((b) => (b.recurringId === id ? { ...b, recurringId: undefined } : b)),
      }));
    },
    [requireWrite],
  );

  const addDocument = useCallback(
    (doc: NewDocument) => {
      if (!requireWrite()) return null;
      const item: BusinessDocument = { ...doc, id: uid("doc_"), createdAt: stamp(), updatedAt: stamp() };
      setData((d) => ({ ...d, documents: [...d.documents, item] }));
      return item;
    },
    [requireWrite],
  );

  const updateDocument = useCallback(
    (id: string, patch: Partial<BusinessDocument>) => {
      if (!requireWrite()) return;
      setData((d) => ({ ...d, documents: d.documents.map((x) => (x.id === id ? { ...x, ...patch, id, updatedAt: stamp() } : x)) }));
    },
    [requireWrite],
  );

  const deleteDocument = useCallback(
    (id: string) => {
      if (!requireWrite()) return;
      setData((d) => {
        const doc = d.documents.find((x) => x.id === id);
        if (doc?.attachment) void deleteAttachment(doc.attachment.id);
        return { ...d, documents: d.documents.filter((x) => x.id !== id) };
      });
    },
    [requireWrite],
  );

  const markAlertsRead = useCallback((ids: string[]) => {
    setData((d) => ({ ...d, readAlerts: Array.from(new Set([...d.readAlerts, ...ids])).slice(-500) }));
  }, []);

  const resetToSample = useCallback(async () => {
    if (!requireWrite()) return;
    await clearAttachments();
    setData(createSeedData(todayISO()));
  }, [requireWrite]);

  const clearAll = useCallback(async () => {
    if (!requireWrite()) return;
    await clearAttachments();
    setData({ ...empty, seededAt: undefined });
  }, [requireWrite]);

  const replaceAll = useCallback(
    (next: LumaData) => {
      if (!requireWrite()) return;
      setData(next);
    },
    [requireWrite],
  );

  const value: StoreValue = {
    ready,
    data,
    today,
    storageError,
    readOnly,
    requireWrite,
    blockedAt,
    dismissBlocked,
    addBill,
    updateBill,
    deleteBill,
    markPaid,
    reopenBill,
    addRecurring,
    updateRecurring,
    deleteRecurring,
    addDocument,
    updateDocument,
    deleteDocument,
    markAlertsRead,
    resetToSample,
    clearAll,
    replaceAll,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore deve ser usado dentro de StoreProvider");
  return ctx;
}
