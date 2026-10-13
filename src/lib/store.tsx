"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { clearAttachments, deleteAttachment } from "./attachments.ts";
import { todayISO } from "./dates.ts";
import { uid } from "./format.ts";
import { createSeedData } from "./seed.ts";
import { LocalStorageRepository, StorageError, type DataRepository } from "./storage.ts";
import type { Bill, BusinessDocument, LumaData, RecurringExpense } from "./types.ts";

type NewBill = Omit<Bill, "id" | "createdAt" | "updatedAt">;
type NewRecurring = Omit<RecurringExpense, "id" | "createdAt" | "updatedAt">;
type NewDocument = Omit<BusinessDocument, "id" | "createdAt" | "updatedAt">;

interface StoreValue {
  ready: boolean;
  data: LumaData;
  today: string;
  storageError: string | null;
  addBill(b: NewBill): Bill;
  updateBill(id: string, patch: Partial<Bill>): void;
  deleteBill(id: string): void;
  markPaid(id: string, paidAt?: string): void;
  reopenBill(id: string): void;
  addRecurring(r: NewRecurring): RecurringExpense;
  updateRecurring(id: string, patch: Partial<RecurringExpense>): void;
  deleteRecurring(id: string): void;
  addDocument(d: NewDocument): BusinessDocument;
  updateDocument(id: string, patch: Partial<BusinessDocument>): void;
  deleteDocument(id: string): void;
  markAlertsRead(ids: string[]): void;
  resetToSample(): Promise<void>;
  clearAll(): Promise<void>;
  replaceAll(data: LumaData): void;
}

const empty: LumaData = { version: 1, bills: [], recurring: [], documents: [], readAlerts: [] };

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children, repository }: { children: ReactNode; repository?: DataRepository }) {
  const repo = useMemo(() => repository ?? new LocalStorageRepository(), [repository]);
  const [data, setData] = useState<LumaData>(empty);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [today, setToday] = useState(todayISO());
  const loaded = useRef(false);

  useEffect(() => {
    const stored = repo.load();
    setData(stored ?? createSeedData(todayISO()));
    loaded.current = true;
    setReady(true);
  }, [repo]);

  // Persiste a cada alteração.
  useEffect(() => {
    if (!loaded.current) return;
    try {
      repo.save(data);
      setStorageError(null);
    } catch (e) {
      setStorageError(e instanceof StorageError ? e.message : "Falha ao salvar os dados.");
    }
  }, [data, repo]);

  // Atualiza "hoje" se o app ficar aberto na virada do dia.
  useEffect(() => {
    const t = setInterval(() => setToday(todayISO()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Sincroniza entre abas abertas.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("luma:")) {
        const fresh = repo.load();
        if (fresh) setData(fresh);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [repo]);

  const stamp = () => new Date().toISOString();

  const addBill = useCallback((b: NewBill) => {
    const bill: Bill = { ...b, id: uid("cta_"), createdAt: stamp(), updatedAt: stamp() };
    setData((d) => ({ ...d, bills: [...d.bills, bill] }));
    return bill;
  }, []);

  const updateBill = useCallback((id: string, patch: Partial<Bill>) => {
    setData((d) => ({ ...d, bills: d.bills.map((b) => (b.id === id ? { ...b, ...patch, id, updatedAt: stamp() } : b)) }));
  }, []);

  const deleteBill = useCallback((id: string) => {
    setData((d) => {
      const bill = d.bills.find((b) => b.id === id);
      if (bill?.attachment) void deleteAttachment(bill.attachment.id);
      return { ...d, bills: d.bills.filter((b) => b.id !== id) };
    });
  }, []);

  const markPaid = useCallback((id: string, paidAt?: string) => {
    setData((d) => ({ ...d, bills: d.bills.map((b) => (b.id === id ? { ...b, paidAt: paidAt ?? todayISO(), updatedAt: stamp() } : b)) }));
  }, []);

  const reopenBill = useCallback((id: string) => {
    setData((d) => ({ ...d, bills: d.bills.map((b) => (b.id === id ? { ...b, paidAt: undefined, updatedAt: stamp() } : b)) }));
  }, []);

  const addRecurring = useCallback((r: NewRecurring) => {
    const rec: RecurringExpense = { ...r, id: uid("rec_"), createdAt: stamp(), updatedAt: stamp() };
    setData((d) => ({ ...d, recurring: [...d.recurring, rec] }));
    return rec;
  }, []);

  const updateRecurring = useCallback((id: string, patch: Partial<RecurringExpense>) => {
    setData((d) => ({ ...d, recurring: d.recurring.map((r) => (r.id === id ? { ...r, ...patch, id, updatedAt: stamp() } : r)) }));
  }, []);

  const deleteRecurring = useCallback((id: string) => {
    // As contas já lançadas continuam existindo; apenas perdem o vínculo.
    setData((d) => ({
      ...d,
      recurring: d.recurring.filter((r) => r.id !== id),
      bills: d.bills.map((b) => (b.recurringId === id ? { ...b, recurringId: undefined } : b)),
    }));
  }, []);

  const addDocument = useCallback((doc: NewDocument) => {
    const item: BusinessDocument = { ...doc, id: uid("doc_"), createdAt: stamp(), updatedAt: stamp() };
    setData((d) => ({ ...d, documents: [...d.documents, item] }));
    return item;
  }, []);

  const updateDocument = useCallback((id: string, patch: Partial<BusinessDocument>) => {
    setData((d) => ({ ...d, documents: d.documents.map((x) => (x.id === id ? { ...x, ...patch, id, updatedAt: stamp() } : x)) }));
  }, []);

  const deleteDocument = useCallback((id: string) => {
    setData((d) => {
      const doc = d.documents.find((x) => x.id === id);
      if (doc?.attachment) void deleteAttachment(doc.attachment.id);
      return { ...d, documents: d.documents.filter((x) => x.id !== id) };
    });
  }, []);

  const markAlertsRead = useCallback((ids: string[]) => {
    setData((d) => ({ ...d, readAlerts: Array.from(new Set([...d.readAlerts, ...ids])).slice(-500) }));
  }, []);

  const resetToSample = useCallback(async () => {
    await clearAttachments();
    setData(createSeedData(todayISO()));
  }, []);

  const clearAll = useCallback(async () => {
    await clearAttachments();
    setData({ ...empty, seededAt: undefined });
  }, []);

  const replaceAll = useCallback((next: LumaData) => setData(next), []);

  const value: StoreValue = {
    ready,
    data,
    today,
    storageError,
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
