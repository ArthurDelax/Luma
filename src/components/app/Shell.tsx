"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  LuBell,
  LuCalendarDays,
  LuChartColumn,
  LuFileText,
  LuFileUp,
  LuHouse,
  LuLayoutDashboard,
  LuLogOut,
  LuMenu,
  LuPlus,
  LuReceipt,
  LuRepeat,
  LuSearch,
  LuSettings,
  LuTags,
  LuX,
} from "react-icons/lu";
import { computeAlerts, ALERT_LEVEL_LABEL } from "@/lib/domain";
import { formatDate, relativeDays } from "@/lib/dates";
import { href } from "@/lib/paths";
import { useStore } from "@/lib/store";
import { initials, ROLE_LABEL, useWorkspace } from "@/lib/workspace";
import { Button, cx, IconButton, Logo } from "../ui";
import { useBillActions } from "./bills/BillActions";
import { HelpButton } from "../support/HelpCenter";
import { DemoBanner } from "./DemoGate";
import { navigate, type RouteId } from "./routing";

export const NAV: { id: RouteId; label: string; icon: ReactNode }[] = [
  { id: "painel", label: "Painel", icon: <LuLayoutDashboard /> },
  { id: "contas", label: "Contas a pagar", icon: <LuReceipt /> },
  { id: "recorrentes", label: "Despesas recorrentes", icon: <LuRepeat /> },
  { id: "categorias", label: "Categorias", icon: <LuTags /> },
  { id: "documentos", label: "Contratos e documentos", icon: <LuFileText /> },
  { id: "calendario", label: "Calendário", icon: <LuCalendarDays /> },
  { id: "alertas", label: "Central de alertas", icon: <LuBell /> },
  { id: "relatorios", label: "Relatórios", icon: <LuChartColumn /> },
  { id: "ajustes", label: "Dados e ajustes", icon: <LuSettings /> },
];

export function useUnreadAlerts() {
  const { data, today } = useStore();
  return useMemo(() => {
    const all = computeAlerts(data, today);
    const read = new Set(data.readAlerts);
    return { all, unread: all.filter((a) => !read.has(a.id)) };
  }, [data, today]);
}

const GROUPS: { title: string; ids: RouteId[] }[] = [
  { title: "Financeiro", ids: ["painel", "contas", "recorrentes", "categorias", "relatorios"] },
  { title: "Gestão", ids: ["documentos", "calendario", "alertas"] },
  { title: "Sistema", ids: ["ajustes"] },
];

function SideNav({ current, onNavigate, counts }: { current: RouteId; onNavigate?: () => void; counts: Partial<Record<RouteId, number>> }) {
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-6">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className="mb-2 px-3 text-[11px] font-semibold text-paper/35">{g.title}</p>
          <div className="flex flex-col gap-0.5">
            {g.ids.map((id) => {
              const item = NAV.find((n) => n.id === id)!;
              const active = current === id;
              return (
                <a
                  key={id}
                  href={`#/${id}`}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "group relative flex items-center gap-3 rounded-full px-3.5 py-2.5 text-[14px] font-medium transition-colors [&>svg]:size-[18px]",
                    active ? "bg-paper text-ink" : "text-paper/60 hover:bg-white/[0.06] hover:text-paper",
                  )}
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {!!counts[id] && (
                    <span className={cx("grid min-w-5 place-items-center rounded-full px-1.5 py-px text-[11px] font-bold tabular", active ? "bg-ink text-paper" : "bg-overdue text-white")}>{counts[id]}</span>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function CompanyCard() {
  const ws = useWorkspace();
  const cloud = ws.mode === "cloud";
  const name = cloud ? (ws.orgName ?? "Sua empresa") : "Empresa Demonstração";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paper font-display text-[13px] font-bold text-ink">{cloud ? initials(name) : "ED"}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-paper" title={name}>
          {name}
        </p>
        <p className="truncate text-[11px] text-paper/45" title={ws.email}>
          {cloud ? `${ws.role ? ROLE_LABEL[ws.role] : ""}${ws.email ? ` · ${ws.email}` : ""}` : "Ambiente de testes"}
        </p>
      </div>
      {ws.switchOrg && (
        <button type="button" onClick={ws.switchOrg} className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold text-paper/60 hover:bg-white/10 hover:text-paper">
          Trocar
        </button>
      )}
    </div>
  );
}

function SessionNote() {
  const ws = useWorkspace();
  if (ws.mode !== "cloud") return <DemoNote />;
  return (
    <button type="button" onClick={ws.logout} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs font-semibold text-paper/70 hover:bg-white/10 hover:text-paper">
      <LuLogOut className="size-4" /> Sair da conta
    </button>
  );
}

function DemoNote() {
  return (
    <div className="dot-grid-light rounded-2xl border border-white/[0.08] p-3.5 text-xs leading-relaxed text-paper/55">
      <p className="mb-0.5 font-semibold text-paper/90">Demonstração</p>
      Dados fictícios e alterações desativadas.{" "}
      <a href={href("/planos/")} className="font-semibold text-paper underline underline-offset-2 hover:no-underline">
        Conhecer planos
      </a>
    </div>
  );
}

function NotificationsButton({ dark = false }: { dark?: boolean }) {
  const { today, markAlertsRead } = useStore();
  const { unread } = useUnreadAlerts();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <IconButton label={`Notificações (${unread.length} não lidas)`} onClick={() => setOpen((o) => !o)} aria-expanded={open} className={cx("relative", dark && "text-white/80 hover:bg-white/10 hover:text-white")}>
        <LuBell className="size-5" />
        {unread.length > 0 && <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-overdue px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-paper">{unread.length > 99 ? "99+" : unread.length}</span>}
      </IconButton>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-[min(22rem,calc(100vw-2rem))] animate-pop-in overflow-hidden rounded-2xl border border-line bg-white text-ink shadow-[var(--shadow-pop)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-display font-semibold">Notificações</p>
            {unread.length > 0 && (
              <button className="text-xs font-semibold text-ink underline-offset-2 hover:underline" onClick={() => markAlertsRead(unread.map((a) => a.id))}>
                Marcar todas como lidas
              </button>
            )}
          </div>
          {unread.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Nenhuma notificação nova.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {unread.slice(0, 8).map((a) => (
                <li key={a.id} className="flex gap-3 px-4 py-3">
                  <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", a.severity === "critico" ? "bg-overdue" : a.severity === "atencao" ? "bg-soon" : "bg-sky-300")} />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-semibold">{a.title}</p>
                    <p className="text-xs text-muted">
                      {ALERT_LEVEL_LABEL[a.level]} — {formatDate(a.date)} ({relativeDays(a.days)})
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <a href="#/alertas" onClick={() => setOpen(false)} className="block border-t border-line bg-paper/60 px-4 py-2.5 text-center text-sm font-semibold text-ink hover:bg-sky-100">
            Abrir central de alertas
          </a>
        </div>
      )}
    </div>
  );
}

export function Shell({ current, children }: { current: RouteId; children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const [fab, setFab] = useState(false);
  const actions = useBillActions();
  const { unread } = useUnreadAlerts();
  const { storageError } = useStore();
  const counts = { alertas: unread.length };

  useEffect(() => {
    setDrawer(false);
    setFab(false);
  }, [current]);

  return (
    <div className="min-h-dvh lg:pl-[264px] print:pl-0">
      {/* Barra lateral (desktop) */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col overflow-y-auto bg-ink px-4 py-6 lg:flex">
        <a href={href("/")} className="mb-6 px-2" aria-label="Luma — página inicial">
          <Logo tone="light" />
        </a>
        <div className="mb-7">
          <CompanyCard />
        </div>
        <SideNav current={current} counts={counts} />
        <div className="mt-auto space-y-3 pt-8">
          <SessionNote />
          <a href={href("/")} className="flex items-center gap-2 px-2 text-xs font-medium text-paper/45 hover:text-paper">
            <LuHouse className="size-4" /> Voltar ao site
          </a>
        </div>
      </aside>

      {/* Gaveta (celular) */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-navy-950/50" onClick={() => setDrawer(false)} />
          <aside className="relative flex h-full w-[82%] max-w-[300px] animate-slide-in flex-col overflow-y-auto bg-ink px-4 py-5">
            <div className="mb-6 flex items-center justify-between px-2">
              <Logo tone="light" />
              <IconButton label="Fechar menu" onClick={() => setDrawer(false)} className="text-white/70 hover:bg-white/10 hover:text-white">
                <LuX className="size-5" />
              </IconButton>
            </div>
            <div className="mb-6">
              <CompanyCard />
            </div>
            <SideNav current={current} counts={counts} onNavigate={() => setDrawer(false)} />
            <div className="mt-auto space-y-3 pt-8">
              <SessionNote />
              <a href={href("/")} className="flex items-center gap-2 px-2 text-xs font-medium text-paper/45">
                <LuHouse className="size-4" /> Voltar ao site
              </a>
            </div>
          </aside>
        </div>
      )}

      {/* Topo */}
      <header className="no-print sticky top-0 z-20 border-b border-line/70 bg-paper/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-2 px-4 sm:px-6 lg:px-8">
          <IconButton label="Abrir menu" className="lg:hidden" onClick={() => setDrawer(true)}>
            <LuMenu className="size-5" />
          </IconButton>
          <a href="#/painel" className="lg:hidden" aria-label="Painel">
            <Logo />
          </a>
          <a href="#/contas" className="hidden h-10 w-80 items-center gap-2.5 whitespace-nowrap rounded-full border border-line bg-white/70 px-4 text-sm text-muted transition-colors hover:border-ink/25 lg:flex">
            <LuSearch className="size-4 shrink-0" />
            <span className="truncate">Buscar contas, fornecedores, chave Pix…</span>
          </a>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden gap-2 sm:flex">
              <Button variant="secondary" icon={<LuFileUp className="size-4" />} onClick={actions.importBoleto}>
                Importar boleto
              </Button>
              <Button icon={<LuPlus className="size-4" />} onClick={() => actions.newBill()}>
                Nova conta
              </Button>
            </div>
            <HelpButton />
            <NotificationsButton />
          </div>
        </div>
      </header>

      <DemoBanner />
      {storageError && <div className="bg-overdue px-4 py-2 text-center text-sm font-medium text-white">{storageError}</div>}

      <main className="mx-auto max-w-[1240px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">{children}</main>

      {/* Navegação inferior (celular) */}
      <nav aria-label="Atalhos" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
        <div className="grid grid-cols-5">
          {([
            ["painel", "Painel", <LuLayoutDashboard key="i" />],
            ["contas", "Contas", <LuReceipt key="i" />],
            null,
            ["calendario", "Agenda", <LuCalendarDays key="i" />],
            ["alertas", "Alertas", <LuBell key="i" />],
          ] as const).map((item) =>
            item === null ? (
              <div key="fab" className="relative flex justify-center">
                <button aria-label="Adicionar" aria-expanded={fab} onClick={() => setFab((f) => !f)} className={cx("-mt-5 grid size-14 place-items-center rounded-full bg-ink text-paper shadow-lg ring-4 ring-paper transition-transform", fab && "rotate-45")}>
                  <LuPlus className="size-6" />
                </button>
                {fab && (
                  <div className="absolute bottom-16 left-1/2 w-56 -translate-x-1/2 animate-pop-in overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-pop)]">
                    <button className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold hover:bg-sky-100" onClick={() => { setFab(false); actions.importBoleto(); }}>
                      <LuFileUp className="size-5" /> Importar boleto
                    </button>
                    <button className="flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left text-sm font-semibold hover:bg-sky-50" onClick={() => { setFab(false); actions.newBill(); }}>
                      <LuPlus className="size-5" /> Nova conta
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <a key={item[0]} href={`#/${item[0]}`} aria-current={current === item[0] ? "page" : undefined} className={cx("relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold [&>svg]:size-5", current === item[0] ? "text-ink" : "text-muted")}>
                {item[2]}
                {item[1]}
                {item[0] === "alertas" && unread.length > 0 && <span className="absolute right-[calc(50%-18px)] top-1.5 size-2 rounded-full bg-overdue" />}
              </a>
            ),
          )}
        </div>
      </nav>
    </div>
  );
}

export { navigate };
