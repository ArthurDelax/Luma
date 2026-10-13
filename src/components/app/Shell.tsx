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
  LuMenu,
  LuPlus,
  LuReceipt,
  LuRepeat,
  LuSettings,
  LuX,
} from "react-icons/lu";
import { computeAlerts, ALERT_LEVEL_LABEL } from "@/lib/domain";
import { formatDate, relativeDays } from "@/lib/dates";
import { href } from "@/lib/paths";
import { useStore } from "@/lib/store";
import { Button, cx, IconButton, Logo } from "../ui";
import { useBillActions } from "./bills/BillActions";
import { navigate, type RouteId } from "./routing";

export const NAV: { id: RouteId; label: string; icon: ReactNode }[] = [
  { id: "painel", label: "Painel", icon: <LuLayoutDashboard /> },
  { id: "contas", label: "Contas a pagar", icon: <LuReceipt /> },
  { id: "recorrentes", label: "Despesas recorrentes", icon: <LuRepeat /> },
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

function SideNav({ current, onNavigate, counts }: { current: RouteId; onNavigate?: () => void; counts: Partial<Record<RouteId, number>> }) {
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = current === item.id;
        return (
          <a
            key={item.id}
            href={`#/${item.id}`}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cx(
              "group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] font-medium transition-colors [&>svg]:size-[18px]",
              active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white",
            )}
          >
            {active && <span className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-sky-400" />}
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {!!counts[item.id] && <span className={cx("rounded-full px-1.5 py-px text-[11px] font-bold tabular", item.id === "alertas" ? "bg-overdue text-white" : "bg-white/12 text-white/80")}>{counts[item.id]}</span>}
          </a>
        );
      })}
    </nav>
  );
}

function DemoNote() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs leading-relaxed text-white/60">
      <p className="font-semibold text-white/85">Versão demonstrativa</p>
      Os dados ficam salvos apenas neste navegador.{" "}
      <a href="#/ajustes" className="font-semibold text-sky-300 hover:underline">
        Saiba mais
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
        {unread.length > 0 && <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-overdue px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white">{unread.length > 99 ? "99+" : unread.length}</span>}
      </IconButton>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-[min(22rem,calc(100vw-2rem))] animate-pop-in overflow-hidden rounded-2xl border border-line bg-white text-ink shadow-[var(--shadow-pop)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-display font-semibold">Notificações</p>
            {unread.length > 0 && (
              <button className="text-xs font-semibold text-navy-600 hover:underline" onClick={() => markAlertsRead(unread.map((a) => a.id))}>
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
                  <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", a.severity === "critico" ? "bg-overdue" : a.severity === "atencao" ? "bg-soon" : "bg-sky-400")} />
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
          <a href="#/alertas" onClick={() => setOpen(false)} className="block border-t border-line bg-paper/60 px-4 py-2.5 text-center text-sm font-semibold text-navy-700 hover:bg-sky-50">
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
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col bg-navy-900 px-4 py-5 lg:flex">
        <a href={href("/")} className="mb-7 px-2" aria-label="Luma — página inicial">
          <Logo tone="light" />
        </a>
        <SideNav current={current} counts={counts} />
        <div className="mt-auto space-y-3">
          <DemoNote />
          <a href={href("/")} className="flex items-center gap-2 px-2 text-xs font-medium text-white/50 hover:text-white">
            <LuHouse className="size-4" /> Voltar ao site
          </a>
        </div>
      </aside>

      {/* Gaveta (celular) */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-navy-950/50" onClick={() => setDrawer(false)} />
          <aside className="relative flex h-full w-[82%] max-w-[300px] animate-slide-in flex-col bg-navy-900 px-4 py-5">
            <div className="mb-6 flex items-center justify-between px-2">
              <Logo tone="light" />
              <IconButton label="Fechar menu" onClick={() => setDrawer(false)} className="text-white/70 hover:bg-white/10 hover:text-white">
                <LuX className="size-5" />
              </IconButton>
            </div>
            <SideNav current={current} counts={counts} onNavigate={() => setDrawer(false)} />
            <div className="mt-auto space-y-3">
              <DemoNote />
              <a href={href("/")} className="flex items-center gap-2 px-2 text-xs font-medium text-white/50">
                <LuHouse className="size-4" /> Voltar ao site
              </a>
            </div>
          </aside>
        </div>
      )}

      {/* Topo */}
      <header className="no-print sticky top-0 z-20 border-b border-line/80 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-2 px-4 sm:px-6 lg:px-8">
          <IconButton label="Abrir menu" className="lg:hidden" onClick={() => setDrawer(true)}>
            <LuMenu className="size-5" />
          </IconButton>
          <a href="#/painel" className="lg:hidden" aria-label="Painel">
            <Logo />
          </a>
          <div className="hidden text-sm text-muted lg:block">
            <span className="font-semibold text-ink">Empresa Demonstração</span> — ambiente de testes
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden gap-2 sm:flex">
              <Button variant="secondary" icon={<LuFileUp className="size-4" />} onClick={actions.importBoleto}>
                Importar boleto
              </Button>
              <Button icon={<LuPlus className="size-4" />} onClick={() => actions.newBill()}>
                Nova conta
              </Button>
            </div>
            <NotificationsButton />
          </div>
        </div>
      </header>

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
                <button aria-label="Adicionar" aria-expanded={fab} onClick={() => setFab((f) => !f)} className={cx("-mt-5 grid size-14 place-items-center rounded-2xl bg-ink text-white shadow-lg ring-4 ring-paper transition-transform", fab && "rotate-45")}>
                  <LuPlus className="size-6" />
                </button>
                {fab && (
                  <div className="absolute bottom-16 left-1/2 w-56 -translate-x-1/2 animate-pop-in overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-pop)]">
                    <button className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold hover:bg-sky-50" onClick={() => { setFab(false); actions.importBoleto(); }}>
                      <LuFileUp className="size-5 text-navy-600" /> Importar boleto
                    </button>
                    <button className="flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left text-sm font-semibold hover:bg-sky-50" onClick={() => { setFab(false); actions.newBill(); }}>
                      <LuPlus className="size-5 text-navy-600" /> Nova conta
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
