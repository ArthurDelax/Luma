"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { clearAttachments, deleteAttachment, setAttachmentBackend } from "./attachments.ts";
import type { CloudSync } from "./cloud.ts";
import { todayISO } from "./dates.ts";
import { DEMO_MODE } from "./demo.ts";
import { uid } from "./format.ts";
import { createSeedData } from "./seed.ts";
import { LocalStorageRepository, MemoryRepository, StorageError, type DataRepository } from "./storage.ts";
import type { Bill, BusinessDocument, CustomCategory, LumaData, RecurringExpense } from "./types.ts";

type NewBill = Omit<Bill, "id" | "createdAt" | "updatedAt">;
type NewRecurring = Omit<RecurringExpense, "id" | "createdAt" | "updatedAt">;
type NewDocument = Omit<BusinessDocument, "id" | "createdAt" | "updatedAt">;

interface StoreValue {
  ready: boolean;
  /** Erro ao carregar os dados do servidor (somente na nuvem). */
  loadError: string | null;
  retryLoad(): void;
  /** Alterações ainda não confirmadas pelo servidor. */
  saving: boolean;
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
  addCategory(name: string): CustomCategory | null;
  /** Renomeia a categoria e atualiza as contas e recorrentes que a usam. */
  renameCategory(id: string, name: string): void;
  deleteCategory(id: string): void;
  /** Marcar alertas como lidos é permitido na demonstração (fica só na memória da página). */
  markAlertsRead(ids: string[]): void;
  resetToSample(): Promise<void>;
  clearAll(): Promise<void>;
  replaceAll(data: LumaData): void;
}

const empty: LumaData = { version: 1, bills: [], recurring: [], documents: [], readAlerts: [] };

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({
  children,
  repository,
  readOnly = DEMO_MODE,
  cloud,
}: {
  children: ReactNode;
  repository?: DataRepository;
  readOnly?: boolean;
  /** Empresa na nuvem: dados carregados e gravados no servidor. */
  cloud?: CloudSync;
}) {
  // Na demonstração os dados vivem só na memória: sempre os mesmos dados fictícios, nada é gravado.
  const repo = useMemo(() => repository ?? (readOnly ? new MemoryRepository() : new LocalStorageRepository()), [repository, readOnly]);
  const [data, setData] = useState<LumaData>(empty);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadNonce, setLoadNonce] = useState(0);
  const [today, setToday] = useState(todayISO());
  const [blockedAt, setBlockedAt] = useState<number | null>(null);
  const loaded = useRef(false);
  /** Último estado confirmado pelo servidor (base para enviar só o que mudou). */
  const synced = useRef<LumaData>(empty);
  const pushing = useRef(false);
  const latest = useRef<LumaData>(empty);

  useEffect(() => {
    if (!cloud) {
      setAttachmentBackend(null);
      const stored = repo.load();
      setData(stored ?? createSeedData(todayISO()));
      loaded.current = true;
      setReady(true);
      return;
    }
    setAttachmentBackend(cloud);
    let alive = true;
    setLoadError(null);
    cloud
      .load()
      .then((d) => {
        if (!alive) return;
        synced.current = d;
        latest.current = d;
        setData(d);
        loaded.current = true;
        setReady(true);
      })
      .catch((e) => alive && setLoadError(e instanceof Error ? e.message : "Não foi possível carregar os dados."));
    return () => {
      alive = false;
      setAttachmentBackend(null);
    };
  }, [repo, cloud, loadNonce]);

  /** Envia ao servidor as diferenças pendentes, uma remessa por vez. */
  const flush = useCallback(async () => {
    if (!cloud || pushing.current) return;
    pushing.current = true;
    try {
      while (latest.current !== synced.current) {
        const target = latest.current;
        setSaving(true);
        try {
          await cloud.push(synced.current, target);
          synced.current = target;
          setStorageError(null);
        } catch (e) {
          setStorageError(`Não foi possível salvar no servidor (${e instanceof Error ? e.message : "erro"}). Tentando de novo…`);
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    } finally {
      pushing.current = false;
      setSaving(false);
    }
  }, [cloud]);

  useEffect(() => {
    if (!loaded.current) return;
    if (cloud) {
      latest.current = data;
      void flush();
      return;
    }
    try {
      repo.save(data);
      setStorageError(null);
    } catch (e) {
      setStorageError(e instanceof StorageError ? e.message : "Falha ao salvar os dados.");
    }
  }, [data, repo, cloud, flush]);

  // Na nuvem: busca alterações feitas por outros usuários da empresa.
  useEffect(() => {
    if (!cloud) return;
    const refresh = async () => {
      if (!loaded.current || pushing.current || latest.current !== synced.current) return;
      try {
        const fresh = await cloud.load();
        if (pushing.current || latest.current !== synced.current) return;
        if (JSON.stringify(fresh) === JSON.stringify(synced.current)) return;
        synced.current = fresh;
        latest.current = fresh;
        setData(fresh);
      } catch {
        /* tenta de novo no próximo ciclo */
      }
    };
    const t = setInterval(refresh, 60_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [cloud]);

  // Avisa antes de fechar a página com alterações ainda não enviadas.
  useEffect(() => {
    if (!cloud) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      if (latest.current !== synced.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [cloud]);

  const retryLoad = useCallback(() => setLoadNonce((n) => n + 1), []);

  useEffect(() => {
    const t = setInterval(() => setToday(todayISO()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (readOnly || cloud) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("luma:")) {
        const fresh = repo.load();
        if (fresh) setData(fresh);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [repo, readOnly, cloud]);

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

  const addCategory = useCallback(
    (name: string) => {
      if (!requireWrite()) return null;
      const cat: CustomCategory = { id: uid("cat_"), name: name.trim(), createdAt: stamp(), updatedAt: stamp() };
      setData((d) => ({ ...d, categories: [...(d.categories ?? []), cat] }));
      return cat;
    },
    [requireWrite],
  );

  const renameCategory = useCallback(
    (id: string, name: string) => {
      if (!requireWrite()) return;
      const next = name.trim();
      setData((d) => {
        const old = d.categories?.find((c) => c.id === id);
        if (!old || old.name === next) return d;
        const now = stamp();
        return {
          ...d,
          categories: (d.categories ?? []).map((c) => (c.id === id ? { ...c, name: next, updatedAt: now } : c)),
          bills: d.bills.map((b) => (b.category === old.name ? { ...b, category: next, updatedAt: now } : b)),
          recurring: d.recurring.map((r) => (r.category === old.name ? { ...r, category: next, updatedAt: now } : r)),
        };
      });
    },
    [requireWrite],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      if (!requireWrite()) return;
      setData((d) => ({ ...d, categories: (d.categories ?? []).filter((c) => c.id !== id) }));
    },
    [requireWrite],
  );

  const markAlertsRead = useCallback((ids: string[]) => {
    setData((d) => ({ ...d, readAlerts: Array.from(new Set([...d.readAlerts, ...ids])).slice(-500) }));
  }, []);

  const resetToSample = useCallback(async () => {
    if (cloud || !requireWrite()) return; // dados fictícios nunca entram numa empresa real
    await clearAttachments();
    setData(createSeedData(todayISO()));
  }, [requireWrite, cloud]);

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
    loadError,
    retryLoad,
    saving,
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
    addCategory,
    renameCategory,
    deleteCategory,
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
