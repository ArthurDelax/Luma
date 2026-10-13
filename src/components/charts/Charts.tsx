"use client";

import { useState } from "react";
import { formatBRL, formatBRLCompact } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Barras empilhadas por mês                                            */
/* ------------------------------------------------------------------ */

export interface BarDatum {
  label: string;
  /** Rótulo longo (tooltip). */
  title: string;
  segments: { key: string; value: number }[];
  highlight?: boolean;
}

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
}

function niceMax(v: number): number {
  if (v <= 0) return 1000;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * exp;
}

export function StackedBars({ data, series, height = 240 }: { data: BarDatum[]; series: SeriesDef[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = data.map((d) => d.segments.reduce((a, s) => a + s.value, 0));
  const max = niceMax(Math.max(...totals, 0));
  const W = 640;
  const H = height;
  const padL = 74;
  const padB = 28;
  const padT = 12;
  const innerW = W - padL - 8;
  const innerH = H - padB - padT;
  const slot = innerW / Math.max(data.length, 1);
  const barW = Math.min(44, slot * 0.56);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const color = (k: string) => series.find((s) => s.key === k)?.color ?? "#999";

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Despesas por mês">
        {ticks.map((t) => {
          const y = padT + innerH - (t / max) * innerH;
          return (
            <g key={t}>
              <line x1={padL} x2={W - 8} y1={y} y2={y} stroke="#e2e8f1" strokeDasharray={t === 0 ? undefined : "3 4"} />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#5b6b84" className="tabular">
                {formatBRLCompact(t).replace(",00", "")}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = padL + slot * i + (slot - barW) / 2;
          let acc = 0;
          const total = totals[i];
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${d.title}: ${formatBRL(total)}`}>
              <rect x={padL + slot * i} y={padT} width={slot} height={innerH} fill={hover === i ? "#f3f8fe" : "transparent"} />
              {d.segments.map((s, si) => {
                const h = (s.value / max) * innerH;
                const y = padT + innerH - acc - h;
                acc += h;
                const isTop = si === d.segments.length - 1 || d.segments.slice(si + 1).every((x) => x.value === 0);
                return h > 0 ? (
                  <path
                    key={s.key}
                    d={roundedTopRect(x, y, barW, h, isTop ? 5 : 0)}
                    fill={color(s.key)}
                    opacity={hover === null || hover === i ? 1 : 0.55}
                    style={{ transition: "opacity .15s" }}
                  />
                ) : null;
              })}
              <text x={x + barW / 2} y={H - 9} textAnchor="middle" fontSize="11.5" fill={d.highlight ? "#0e1f3d" : "#5b6b84"} fontWeight={d.highlight ? 700 : 500}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-44 -translate-x-1/2 rounded-lg bg-navy-900 px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: `${((padL + slot * hover + slot / 2) / W) * 100}%` }}
        >
          <div className="mb-1 font-semibold first-letter:uppercase">{data[hover].title}</div>
          {data[hover].segments.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-white/75">
                <span className="size-2 rounded-sm" style={{ background: color(s.key) }} />
                {series.find((x) => x.key === s.key)?.label}
              </span>
              <span className="tabular font-semibold">{formatBRL(s.value)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-white/15 pt-1">
            <span className="text-white/75">Total</span>
            <span className="tabular font-semibold">{formatBRL(totals[hover])}</span>
          </div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-4 pl-1 text-xs text-muted">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function roundedTopRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

/* ------------------------------------------------------------------ */
/* Barras horizontais por categoria                                     */
/* ------------------------------------------------------------------ */

/**
 * Para comparar categorias usamos barras horizontais ordenadas (mais fáceis de ler
 * que pizza com muitas fatias), com valor e percentual ao lado.
 */
export function CategoryBars({ data, limit = 7 }: { data: { label: string; value: number }[]; limit?: number }) {
  const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, limit);
  const rest = sorted.slice(limit).reduce((a, d) => a + d.value, 0);
  if (rest > 0) top.push({ label: "Demais categorias", value: rest });
  const total = sorted.reduce((a, d) => a + d.value, 0);
  const max = Math.max(...top.map((d) => d.value), 1);
  return (
    <ul className="space-y-3">
      {top.map((d, i) => (
        <li key={d.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate font-medium">{d.label}</span>
            <span className="shrink-0 tabular text-muted">
              <span className="font-semibold text-ink">{formatBRL(d.value)}</span> · {total ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-sky-100">
            <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: i === 0 ? "#12264a" : i < 3 ? "#3f8ae0" : "#9ec6f2", transition: "width .4s ease" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
