"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { LuArrowLeft, LuHouse, LuLayers, LuLayoutDashboard, LuLogOut, LuMenu, LuQrCode, LuStore, LuTruck, LuUtensils, LuX } from "react-icons/lu";
import { emptyMenu, slugify } from "@/lib/menu/logic";
import type { MenuRepository } from "@/lib/menu/repo";
import type { MenuData, MenuRecord } from "@/lib/menu/types";
import { href } from "@/lib/paths";
import { HelpButton } from "../../support/HelpCenter";
import { PublicMenu } from "../PublicMenu";
import { Button, ConfirmProvider, cx, IconButton, Logo, LogoMark, ToastProvider, usePresence, useToast } from "../../ui";
import { CatalogPage } from "./CatalogPage";
import { EditorContext, type EditorContextValue } from "./context";
import { GroupsPage } from "./GroupsPage";
import { OrdersPage } from "./OrdersPage";
import { OverviewPage } from "./OverviewPage";
import { QrPage } from "./QrPage";
import { StorePage } from "./StorePage";

export type Tab = "inicio" | "cardapio" | "adicionais" | "loja" | "pedidos" | "qrcode";

const NAV: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "inicio", label: "Início", icon: <LuLayoutDashboard /> },
  { id: "cardapio", label: "Cardápio", icon: <LuUtensils /> },
  { id: "adicionais", label: "Adicionais", icon: <LuLayers /> },
  { id: "loja", label: "Loja", icon: <LuStore /> },
  { id: "pedidos", label: "Pedidos e entrega", icon: <LuTruck /> },
  { id: "qrcode", label: "QR Code", icon: <LuQrCode /> },
];

export interface EditorSession {
  kind: "client" | "admin" | "demo";
  email?: string;
  roleLabel?: string;
  onLogout?: () => void;
  onBack?: () => void;
  switchOrg?: () => void;
  /** aviso fixo no topo (ex.: pagamento pendente) */
  banner?: ReactNode;
}

export function MenuEditor(props: { repo: MenuRepository; orgName: string; readOnly?: boolean; session: EditorSession; publicUrl: (slug: string) => string; initial?: () => MenuRecord }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <EditorScreen {...props} />
      </ConfirmProvider>
    </ToastProvider>
  );
}

function EditorScreen({ repo, orgName, readOnly = false, session, publicUrl, initial }: { repo: MenuRepository; orgName: string; readOnly?: boolean; session: EditorSession; publicUrl: (slug: string) => string; initial?: () => MenuRecord }) {
  const toast = useToast();
  const [record, setRecordState] = useState<MenuRecord | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("inicio");
  const [preview, setPreview] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const drawerP = usePresence(drawer, 260);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const existing = await repo.load();
      setRecordState(existing ?? initial?.() ?? { slug: slugify(orgName), published: false, data: emptyMenu(orgName) });
      // cardápio que ainda não existe no servidor fica "pendente" até o primeiro salvar
      setSaved(existing ? JSON.stringify(existing) : "");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Não foi possível carregar o cardápio.");
    }
  }, [repo, orgName, initial]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = useMemo(() => (record ? JSON.stringify(record) : ""), [record]);
  const dirty = !!record && current !== saved;

  const save = useCallback(
    async (next?: MenuRecord) => {
      const rec = next ?? record;
      if (!rec || readOnly) return;
      setSaving(true);
      try {
        const r = await repo.save(rec);
        const merged = { ...rec, updatedAt: r.updatedAt };
        setRecordState(merged);
        setSaved(JSON.stringify(merged));
        toast("success", next && next.published !== record?.published ? (next.published ? "Cardápio publicado." : "Cardápio fora do ar.") : "Alterações salvas.");
      } catch (e) {
        toast("error", e instanceof Error ? e.message : "Não foi possível salvar.");
      } finally {
        setSaving(false);
      }
    },
    [record, readOnly, repo, toast],
  );

  const discard = () => {
    if (!saved) return;
    setRecordState(JSON.parse(saved) as MenuRecord);
  };

  // Ctrl+S salva; sair com alterações pendentes pede confirmação do navegador
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty) void save();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [dirty, save]);

  useEffect(() => {
    document.title = `${NAV.find((n) => n.id === tab)?.label ?? "Painel"} · ${orgName} · Luma`;
  }, [tab, orgName]);

  const go = (t: Tab) => {
    setTab(t);
    setDrawer(false);
    window.scrollTo({ top: 0 });
  };

  if (loadError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper px-4">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <LogoMark className="size-10" />
          <p className="font-display text-lg font-semibold">Não foi possível carregar o cardápio</p>
          <p className="text-sm text-muted">{loadError}</p>
          <div className="flex gap-2">
            {session.onBack && (
              <Button variant="secondary" onClick={session.onBack}>
                Voltar
              </Button>
            )}
            <Button onClick={load}>Tentar de novo</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper">
        <div className="flex flex-col items-center gap-3 text-sm text-muted">
          <LogoMark className="size-10 animate-pulse" />
          Carregando o cardápio…
        </div>
      </div>
    );
  }

  if (preview) {
    return (
      <>
        <PublicMenu
          menu={record.data}
          slug={`previa-${record.slug}`}
          notice={
            <span className="flex items-center gap-3">
              {dirty ? "Prévia com alterações não salvas" : record.published ? "Prévia do cardápio publicado" : "Prévia: o cardápio ainda não está no ar"}
              <button type="button" onClick={() => setPreview(false)} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#1c1712]">
                Voltar ao painel
              </button>
            </span>
          }
        />
      </>
    );
  }

  const ctx: EditorContextValue = {
    record,
    menu: record.data,
    update: (fn: (m: MenuData) => MenuData) => setRecordState((r) => (r ? { ...r, data: fn(r.data) } : r)),
    setRecord: (fn) => setRecordState((r) => (r ? fn(r) : r)),
    repo,
    readOnly,
    publicUrl,
    clean: !dirty && !!saved,
  };

  const sidebar = (onNav?: () => void) => (
    <>
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2.5">
        <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-paper font-display text-[13px] font-bold text-ink">
          {record.data.store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={record.data.store.logoUrl} alt="" className="size-full object-cover" />
          ) : (
            (orgName.match(/\b\w/g) ?? ["L"]).slice(0, 2).join("").toUpperCase()
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-paper" title={orgName}>
            {orgName}
          </p>
          <p className="truncate text-[11px] text-paper/45" title={session.email}>
            {session.kind === "demo" ? "Demonstração" : session.kind === "admin" ? "Administração da plataforma" : `${session.roleLabel ?? ""}${session.email ? ` · ${session.email}` : ""}`}
          </p>
        </div>
        {session.switchOrg && (
          <button type="button" onClick={session.switchOrg} className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold text-paper/60 hover:bg-white/10 hover:text-paper">
            Trocar
          </button>
        )}
      </div>
      <nav aria-label="Seções do painel" className="flex flex-col gap-0.5">
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => {
              go(n.id);
              onNav?.();
            }}
            aria-current={tab === n.id ? "page" : undefined}
            className={cx("flex items-center gap-3 rounded-full px-3.5 py-2.5 text-left text-[14px] font-medium transition-colors [&>svg]:size-[18px]", tab === n.id ? "bg-paper text-ink" : "text-paper/60 hover:bg-white/[0.06] hover:text-paper")}
          >
            {n.icon}
            {n.label}
          </button>
        ))}
      </nav>
      <div className="mt-auto space-y-2 pt-8">
        {session.onBack && (
          <button type="button" onClick={session.onBack} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs font-semibold text-paper/70 hover:bg-white/10 hover:text-paper">
            <LuArrowLeft className="size-4" /> {session.kind === "admin" ? "Voltar ao painel da plataforma" : "Voltar"}
          </button>
        )}
        {session.onLogout && (
          <button type="button" onClick={session.onLogout} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs font-semibold text-paper/70 hover:bg-white/10 hover:text-paper">
            <LuLogOut className="size-4" /> Sair da conta
          </button>
        )}
        <a href={href("/")} className="flex items-center gap-2 px-2 text-xs font-medium text-paper/45 hover:text-paper">
          <LuHouse className="size-4" /> Voltar ao site
        </a>
      </div>
    </>
  );

  return (
    <EditorContext.Provider value={ctx}>
      <div className="min-h-dvh lg:pl-[264px]">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col overflow-y-auto bg-ink px-4 py-6 lg:flex">
          <a href={href("/")} className="mb-6 px-2" aria-label="Luma — página inicial">
            <Logo tone="light" />
          </a>
          {sidebar()}
        </aside>

        {drawerP.render && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div data-state={drawerP.state} className="anim-fade absolute inset-0 bg-navy-950/50" onClick={() => setDrawer(false)} />
            <aside data-state={drawerP.state} className="anim-drawer relative flex h-full w-[82%] max-w-[300px] flex-col overflow-y-auto overscroll-contain bg-ink px-4 py-5 shadow-[var(--shadow-pop)]">
              <div className="mb-6 flex items-center justify-between px-2">
                <Logo tone="light" />
                <IconButton label="Fechar menu" onClick={() => setDrawer(false)} className="text-white/70 hover:bg-white/10 hover:text-white">
                  <LuX className="size-5" />
                </IconButton>
              </div>
              {sidebar(() => setDrawer(false))}
            </aside>
          </div>
        )}

        <header className="sticky top-0 z-20 border-b border-line/70 bg-paper/95 sm:bg-paper/80 sm:backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1100px] items-center gap-2 px-4 sm:px-6 lg:px-8">
            <IconButton label="Abrir menu" className="lg:hidden" onClick={() => setDrawer(true)}>
              <LuMenu className="size-5" />
            </IconButton>
            <span className="truncate font-display text-base font-semibold lg:hidden">{NAV.find((n) => n.id === tab)?.label}</span>
            {session.kind === "admin" && <span className="hidden rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-paper sm:inline">Montando como administrador</span>}
            {session.kind === "demo" && <span className="hidden rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-ink sm:inline">Demonstração: as alterações ficam só neste navegador</span>}
            {readOnly && <span className="hidden rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-ink sm:inline">Somente consulta</span>}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPreview(true)}>
                Prévia
              </Button>
              {session.kind === "client" && <HelpButton />}
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden" role="tablist" aria-label="Seções">
            {NAV.map((n) => (
              <button key={n.id} type="button" role="tab" aria-selected={tab === n.id} onClick={() => go(n.id)} className={cx("shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold", tab === n.id ? "bg-ink text-paper" : "text-muted")}>
                {n.label}
              </button>
            ))}
          </div>
        </header>

        {session.banner}

        <main className="mx-auto max-w-[1100px] px-4 pb-32 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <div key={tab} className="page-enter">
            {tab === "inicio" && <OverviewPage saving={saving} onPreview={() => setPreview(true)} onGo={go} onPublish={(published) => void save({ ...record, published })} />}
            {tab === "cardapio" && <CatalogPage onGoGroups={() => go("adicionais")} />}
            {tab === "adicionais" && <GroupsPage />}
            {tab === "loja" && <StorePage />}
            {tab === "pedidos" && <OrdersPage />}
            {tab === "qrcode" && <QrPage />}
          </div>
        </main>

        {/* barra de salvar */}
        {!readOnly && (
          <div className={cx("fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-[transform,opacity] duration-300 [transition-timing-function:var(--ease-out-app)] lg:left-[264px]", dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0")}>
            <div className="mx-auto flex max-w-[860px] items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-paper shadow-[var(--shadow-pop)] sm:px-5">
              <span className="size-2 shrink-0 rounded-full bg-soon" />
              <p className="min-w-0 flex-1 text-sm font-semibold">
                {saved ? "Alterações não salvas" : "Cardápio novo: salve para guardar"}
                {record.published && saved && <span className="hidden font-normal text-paper/55 sm:inline"> · entram no ar ao salvar</span>}
              </p>
              {saved && (
                <button type="button" className="h-8 rounded-full px-3.5 text-[13px] font-semibold text-paper/80 transition-colors hover:bg-white/10 hover:text-paper disabled:opacity-50" onClick={discard} disabled={saving}>
                  Descartar
                </button>
              )}
              <Button size="sm" variant="secondary" onClick={() => save()} disabled={saving}>
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </EditorContext.Provider>
  );
}
