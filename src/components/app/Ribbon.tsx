"use client";

import { useState } from "react";
import { addDays, diffDays, parseISO } from "@/lib/dates";
import { formatBRL } from "@/lib/format";
import { cx } from "../ui";

export type RibbonKind = "conta" | "vencida" | "recorrente" | "contrato" | "documento";

export interface RibbonEvent {
  id: string;
  date: string;
  kind: RibbonKind;
  label: string;
  amount?: number;
  onClick?: () => void;
}

const KIND_COLOR: Record<RibbonKind, string> = {
  vencida: "#c23b3b",
  conta: "#3f8ae0",
  recorrente: "#9ec6f2",
  contrato: "#6a4fc7",
  documento: "#0f7f8c",
};

export const RIBBON_LEGEND: { kind: RibbonKind; label: string }[] = [
  { kind: "vencida", label: "Vencida" },
  { kind: "conta", label: "Conta a pagar" },
  { kind: "recorrente", label: "Recorrente prevista" },
  { kind: "contrato", label: "Contrato" },
  { kind: "documento", label: "Documento" },
];

const WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/**
 * Faixa de vencimentos: os próximos dias lado a lado, cada um com uma coluna
 * de "luzes" proporcional ao valor que vence. Vencidas aparecem agrupadas à esquerda.
 */
export function Ribbon({ today, events, days = 30, tone = "light", onDayClick }: { today: string; events: RibbonEvent[]; days?: number; tone?: "light" | "dark"; onDayClick?: (date: string) => void }) {
  const [active, setActive] = useState<string | null>(null);
  const overdue = events.filter((e) => e.kind === "vencida" || e.date < today);
  const byDay = new Map<string, RibbonEvent[]>();
  for (const e of events) {
    if (e.date < today) continue;
    const list = byDay.get(e.date) ?? [];
    list.push(e);
    byDay.set(e.date, list);
  }
  const dayList = Array.from({ length: days }, (_, i) => addDays(today, i));
  const maxAmount = Math.max(1, ...dayList.map((d) => (byDay.get(d) ?? []).reduce((a, e) => a + (e.amount ?? 0), 0)));
  const dark = tone === "dark";
  const activeEvents = active === "overdue" ? overdue : active ? byDay.get(active) ?? [] : [];

  return (
    <div>
      <div className="flex items-stretch gap-2">
        {overdue.length > 0 && (
          <button
            type="button"
            onClick={() => setActive(active === "overdue" ? null : "overdue")}
            className={cx(
              "flex w-16 shrink-0 flex-col items-center justify-end gap-1 rounded-xl border px-1 pb-2 pt-2 text-center transition-colors",
              dark ? "border-white/10 bg-white/5 hover:bg-white/10" : "border-overdue/20 bg-overdue-soft/70 hover:bg-overdue-soft",
              active === "overdue" && "ring-2 ring-overdue/50",
            )}
            aria-label={`${overdue.length} itens vencidos`}
          >
            <span className="font-display text-xl font-semibold text-overdue">{overdue.length}</span>
            <span className={cx("text-[11px] font-semibold leading-tight", dark ? "text-white/70" : "text-overdue")}>vencidos</span>
          </button>
        )}
        <div className="min-w-0 flex-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
          <div className="flex min-w-[640px] items-end gap-[3px]">
            {dayList.map((d) => {
              const list = byDay.get(d) ?? [];
              const total = list.reduce((a, e) => a + (e.amount ?? 0), 0);
              const date = parseISO(d);
              const isToday = d === today;
              const isMonthStart = date.getDate() === 1;
              const weekend = date.getDay() === 0 || date.getDay() === 6;
              const h = list.length ? 18 + (total / maxAmount) * 58 : 0;
              return (
                <button
                  type="button"
                  key={d}
                  onClick={() => {
                    setActive(active === d ? null : d);
                    onDayClick?.(d);
                  }}
                  aria-label={`${date.getDate()}/${date.getMonth() + 1}: ${list.length} vencimento(s)${total ? `, ${formatBRL(total)}` : ""}`}
                  className={cx("group flex flex-1 flex-col items-center gap-1.5 rounded-lg pt-1 transition-colors", active === d && (dark ? "bg-white/10" : "bg-sky-100"), dark ? "hover:bg-white/5" : "hover:bg-sky-50")}
                >
                  <div className="flex h-20 w-full items-end justify-center">
                    {list.length > 0 ? (
                      <div className="flex w-[70%] max-w-4 flex-col-reverse overflow-hidden rounded-full" style={{ height: h }}>
                        {list.map((e) => (
                          <span key={e.id} className="w-full" style={{ background: KIND_COLOR[e.kind], flex: `${Math.max(e.amount ?? 0, maxAmount * 0.12)} 1 0` }} />
                        ))}
                      </div>
                    ) : (
                      <span className={cx("mb-0.5 size-1 rounded-full", dark ? "bg-white/20" : "bg-slate-300")} />
                    )}
                  </div>
                  <span
                    className={cx(
                      "grid size-6 place-items-center rounded-full text-[11px] font-semibold tabular",
                      isToday ? (dark ? "bg-sky-400 text-navy-950" : "bg-ink text-white") : weekend ? (dark ? "text-white/35" : "text-slate-400") : dark ? "text-white/70" : "text-slate-600",
                    )}
                  >
                    {date.getDate()}
                  </span>
                  <span className={cx("h-3 text-[10px] leading-none", dark ? "text-white/45" : "text-muted")}>{isToday ? "hoje" : isMonthStart ? ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][date.getMonth()] : WEEK[date.getDay()][0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {active && activeEvents.length > 0 && (
        <ul className={cx("mt-3 divide-y rounded-xl border text-sm", dark ? "divide-white/10 border-white/10 bg-white/5" : "divide-line border-line bg-white")}>
          {activeEvents.slice(0, 8).map((e) => (
            <li key={e.id}>
              <button type="button" onClick={e.onClick} disabled={!e.onClick} className={cx("flex w-full items-center gap-3 px-3 py-2 text-left", e.onClick && (dark ? "hover:bg-white/5" : "hover:bg-sky-50"))}>
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: KIND_COLOR[e.kind] }} />
                <span className="min-w-0 flex-1 truncate">{e.label}</span>
                {e.kind === "vencida" && <span className="text-xs text-overdue">há {Math.abs(diffDays(today, e.date))} d</span>}
                {e.amount !== undefined && <span className="tabular font-semibold">{formatBRL(e.amount)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={cx("mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs", dark ? "text-white/60" : "text-muted")}>
        {RIBBON_LEGEND.map((l) => (
          <span key={l.kind} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: KIND_COLOR[l.kind] }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
