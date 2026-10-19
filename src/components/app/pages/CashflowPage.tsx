"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { LuArrowDownLeft, LuArrowUpRight, LuCircleCheck, LuMessageCircle, LuPencil, LuTriangleAlert } from "react-icons/lu";
import { projectCash, type CashProjection, type Suggestion } from "@/lib/cashflow";
import { formatDate, relativeDays } from "@/lib/dates";
import { amountToInput, formatBRL, parseBRL } from "@/lib/format";
import { useStore } from "@/lib/store";
import { Button, cx, Field, Input, Modal, ModalCloseButton, PageHeader, Segmented, useToast } from "../../ui";
import { StatementImportButton } from "../imports/StatementImport";
import { navigate } from "../routing";

const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function useCashProjection(horizon = 30): CashProjection {
  const { data, today } = useStore();
  return useMemo(() => projectCash(data, today, horizon), [data, today, horizon]);
}

export function CashflowPage() {
  const { data } = useStore();
  const [horizon, setHorizon] = useState<"30" | "60" | "90">("30");
  const p = useCashProjection(Number(horizon));
  const [editing, setEditing] = useState(false);

  // movimentos agrupados por dia (com saldo do fim do dia)
  const groups = useMemo(() => {
    const byDay = new Map<string, typeof p.items>();
    for (const it of p.items) byDay.set(it.date, [...(byDay.get(it.date) ?? []), it]);
    return Array.from(byDay, ([date, items]) => ({ date, items, balance: p.days.find((d) => d.date === date)?.balance ?? 0 }));
  }, [p]);

  return (
    <div>
      <PageHeader title="Fluxo de caixa" description="Quanto vai ter na conta nos próximos dias, somando o que entra e o que sai." actions={<StatementImportButton />} />

      {/* Saldo atual */}
      <section className="dot-grid-light relative mb-5 overflow-hidden rounded-[28px] bg-ink p-5 text-paper sm:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-paper/55">{p.hasBalance ? `Saldo em caixa informado em ${formatDate(data.cash!.balanceDate)}` : "Saldo em caixa"}</p>
            <p className="mt-1 font-display text-[2.4rem] font-semibold leading-none tracking-[-0.03em] tabular sm:text-[3rem]">{p.hasBalance ? formatBRL(p.start) : "—"}</p>
            {p.stale && <p className="mt-2 text-sm text-[#ffcf86]">Saldo informado há mais de 7 dias. Atualize para a previsão ficar certa.</p>}
            {!p.hasBalance && <p className="mt-2 text-sm text-paper/60">Informe quanto a empresa tem hoje nas contas para a Luma prever o caixa.</p>}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Mini label="Entradas" value={formatBRL(p.totalIn)} className="text-[#7fdcab]" />
            <Mini label="Saídas" value={formatBRL(p.totalOut)} className="text-[#ff8f86]" />
            <Mini label={`Saldo em ${horizon} dias`} value={formatBRL(p.end)} className={p.end < 0 ? "text-[#ff8f86]" : "text-paper"} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setEditing(true)} className="inline-flex h-10 items-center gap-2 rounded-full bg-paper px-4 text-sm font-semibold text-ink transition-transform active:scale-95">
            <LuPencil className="size-4" /> {p.hasBalance ? "Atualizar saldo" : "Informar saldo"}
          </button>
          <div className="ml-auto [&_[role=tablist]]:bg-white/10 [&_[aria-selected=false]]:text-paper/60">
            <Segmented
              label="Período da previsão"
              value={horizon}
              onChange={setHorizon}
              options={[
                { value: "30", label: "30 dias" },
                { value: "60", label: "60 dias" },
                { value: "90", label: "90 dias" },
              ]}
            />
          </div>
        </div>
      </section>

      <CashAlert p={p} />

      {/* Gráfico */}
      <section className="card mb-5 p-4 sm:p-6">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-base font-semibold">Saldo previsto dia a dia</h2>
          <span className="text-xs text-muted">Menor saldo: <strong className={cx("tabular", p.lowest.balance < 0 ? "text-overdue" : "text-ink")}>{formatBRL(p.lowest.balance)}</strong> em {shortDate(p.lowest.date)}</span>
        </div>
        <BalanceChart p={p} />
      </section>

      {/* Movimentos */}
      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-4 py-3.5 font-display text-base font-semibold sm:px-6">Próximos movimentos</h2>
        {groups.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted">Nada previsto para o período. Cadastre contas a pagar e a receber.</p>
        ) : (
          <ul className="divide-y divide-line">
            {groups.map((g) => (
              <li key={g.date} className="px-4 py-3 sm:px-6">
                <div className="mb-1.5 flex items-baseline justify-between text-xs">
                  <span className="font-semibold text-muted">
                    {formatDate(g.date)} · {relativeDays(Math.round((Date.parse(g.date) - Date.parse(p.from)) / 86400000))}
                  </span>
                  <span className={cx("font-semibold tabular", g.balance < 0 ? "text-overdue" : "text-muted")}>saldo {formatBRL(g.balance)}</span>
                </div>
                <ul className="space-y-1">
                  {g.items.map((it) => (
                    <li key={it.kind + it.id} className="flex items-center gap-2.5 text-sm">
                      <span className={cx("grid size-6 shrink-0 place-items-center rounded-full", it.kind === "receber" ? "bg-paid-soft text-paid" : "bg-overdue-soft text-overdue")}>
                        {it.kind === "receber" ? <LuArrowDownLeft className="size-3.5" /> : <LuArrowUpRight className="size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{it.party}</span>
                        <span className="text-muted"> · {it.label}{it.kind === "recorrente" ? " (recorrente)" : ""}{it.overdue ? " (vencida)" : ""}</span>
                      </span>
                      <span className={cx("shrink-0 font-semibold tabular", it.kind === "receber" ? "text-paid" : "text-ink")}>
                        {it.kind === "receber" ? "+" : "−"} {formatBRL(it.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CashSettingsModal open={editing} onClose={() => setEditing(false)} />
    </div>
  );
}

function Mini({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 sm:px-4">
      <p className="text-[11px] text-paper/50 sm:text-xs">{label}</p>
      <p className={cx("font-display text-sm font-semibold tabular sm:text-lg", className)}>{value}</p>
    </div>
  );
}

/** Aviso principal: vai faltar dinheiro? (usado também no painel) */
export function CashAlert({ p, compact = false }: { p: CashProjection; compact?: boolean }) {
  const mb = compact ? "" : "mb-5 ";
  if (!p.hasBalance) {
    return (
      <section className={`${mb}flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-soon/30 bg-soon-soft px-4 py-3.5 text-sm sm:px-5`}>
        <p>
          <strong>Previsão de caixa:</strong> informe o saldo atual da empresa para a Luma avisar se vai faltar dinheiro.
        </p>
        {compact && (
          <Button size="sm" onClick={() => navigate("caixa")}>
            Informar saldo
          </Button>
        )}
      </section>
    );
  }
  if (!p.firstNegative) {
    return (
      <section className={`${mb}flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-paid/25 bg-paid-soft/70 px-4 py-3.5 text-sm sm:px-5`}>
        <p className="flex items-center gap-2">
          <LuCircleCheck className="size-5 shrink-0 text-paid" />
          <span>
            <strong>Caixa positivo nos próximos {Math.round((Date.parse(p.to) - Date.parse(p.from)) / 86400000)} dias.</strong> Menor saldo previsto: {formatBRL(p.lowest.balance)} em {shortDate(p.lowest.date)}.
          </span>
        </p>
        {compact && (
          <Button size="sm" variant="secondary" onClick={() => navigate("caixa")}>
            Ver fluxo de caixa
          </Button>
        )}
      </section>
    );
  }
  const n = p.firstNegative;
  return (
    <section role="alert" className={`${mb}overflow-hidden rounded-2xl border border-overdue/30 bg-overdue-soft`}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="flex gap-3">
          <LuTriangleAlert className="mt-0.5 size-5 shrink-0 text-overdue" />
          <div>
            <p className="font-display text-base font-semibold text-overdue sm:text-lg">
              {n.daysAhead === 0 ? "Hoje" : `Em ${n.daysAhead} ${n.daysAhead === 1 ? "dia" : "dias"} (${shortDate(n.date)})`} o caixa fica negativo em {formatBRL(-n.balance)}
            </p>
            {n.dueThatDay.length > 0 && (
              <p className="mt-1 text-sm text-slate-700">
                Vence nesse dia: {n.dueThatDay.slice(0, 3).map((x) => `${x.party} (${formatBRL(x.amount)})`).join(", ")}
                {n.dueThatDay.length > 3 ? "…" : ""}
              </p>
            )}
          </div>
        </div>
        {compact && (
          <Button size="sm" variant="danger" onClick={() => navigate("caixa")}>
            Ver o que fazer
          </Button>
        )}
      </div>
      {!compact && p.suggestions.length > 0 && (
        <div className="grid gap-px border-t border-overdue/15 bg-overdue/10 sm:grid-cols-3">
          {p.suggestions.map((s) => (
            <SuggestionCard key={s.kind} s={s} />
          ))}
        </div>
      )}
    </section>
  );
}

function SuggestionCard({ s }: { s: Suggestion }) {
  const go = s.kind === "cobrar" || s.kind === "antecipar" ? () => navigate("receber") : () => navigate("contas", { status: "abertas" });
  return (
    <button type="button" onClick={go} className="bg-white/70 p-4 text-left transition-colors hover:bg-white">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        {s.kind === "cobrar" && <LuMessageCircle className="size-4 text-paid" />}
        {s.title}
      </p>
      <p className="mt-0.5 font-display text-lg font-semibold tabular">{formatBRL(s.amount)}</p>
      <p className="mt-0.5 line-clamp-2 text-xs text-muted">{s.detail}</p>
    </button>
  );
}

/** Gráfico de linha do saldo, com área vermelha abaixo de zero. */
function BalanceChart({ p }: { p: CashProjection }) {
  const W = 760, H = 220, PL = 8, PR = 8, PT = 14, PB = 26;
  const vals = p.days.map((d) => d.balance);
  const max = Math.max(0, ...vals);
  const min = Math.min(0, ...vals);
  const span = max - min || 1;
  const x = (i: number) => PL + (i / Math.max(1, p.days.length - 1)) * (W - PL - PR);
  const y = (v: number) => PT + ((max - v) / span) * (H - PT - PB);
  const line = p.days.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.balance).toFixed(1)}`).join(" ");
  const area = `${line} L${x(p.days.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const [hover, setHover] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const step = p.days.length > 60 ? 14 : 7;
  const h = hover !== null ? p.days[hover] : null;

  const onMove = (clientX: number) => {
    const r = svg.current?.getBoundingClientRect();
    if (!r) return;
    const rel = ((clientX - r.left) / r.width) * W;
    const i = Math.round(((rel - PL) / (W - PL - PR)) * (p.days.length - 1));
    setHover(Math.max(0, Math.min(p.days.length - 1, i)));
  };

  return (
    <div className="relative">
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="h-[220px] w-full touch-pan-y select-none"
        role="img"
        aria-label={`Saldo previsto de ${formatBRL(p.start)} hoje a ${formatBRL(p.end)} em ${formatDate(p.to)}`}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={() => setHover(null)}
      >
        <defs>
          <clipPath id="above">
            <rect x="0" y="0" width={W} height={y(0)} />
          </clipPath>
          <clipPath id="below">
            <rect x="0" y={y(0)} width={W} height={H - y(0)} />
          </clipPath>
        </defs>
        <path d={area} fill="#1f7f55" opacity="0.1" clipPath="url(#above)" />
        <path d={area} fill="#cf3f3c" opacity="0.16" clipPath="url(#below)" />
        <line x1={PL} x2={W - PR} y1={y(0)} y2={y(0)} stroke="#c7c5bb" strokeDasharray="4 4" />
        <path d={line} fill="none" stroke="#111" strokeWidth="2.5" strokeLinejoin="round" clipPath="url(#above)" />
        <path d={line} fill="none" stroke="#cf3f3c" strokeWidth="2.5" strokeLinejoin="round" clipPath="url(#below)" />
        {p.days.map((d, i) =>
          i % step === 0 ? (
            <text key={d.date} x={x(i)} y={H - 6} fontSize="11" fill="#6b6a63" textAnchor={i === 0 ? "start" : "middle"}>
              {shortDate(d.date)}
            </text>
          ) : null,
        )}
        {p.firstNegative && (
          <circle cx={x(p.days.findIndex((d) => d.date === p.firstNegative!.date))} cy={y(p.firstNegative.balance)} r="5" fill="#cf3f3c" stroke="#fff" strokeWidth="2" />
        )}
        {h && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PT} y2={H - PB} stroke="#111" strokeOpacity="0.2" />
            <circle cx={x(hover)} cy={y(h.balance)} r="4.5" fill={h.balance < 0 ? "#cf3f3c" : "#111"} />
          </g>
        )}
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-0 rounded-xl bg-ink px-3 py-2 text-xs text-paper shadow-lg" style={{ left: `clamp(0px, calc(${(x(hover!) / W) * 100}% - 70px), calc(100% - 150px))` }}>
          <p className="font-semibold">{formatDate(h.date)}</p>
          <p className="tabular">Saldo: {formatBRL(h.balance)}</p>
          {(h.inflow > 0 || h.outflow > 0) && (
            <p className="tabular text-paper/70">
              {h.inflow > 0 && `+${formatBRL(h.inflow)} `}
              {h.outflow > 0 && `−${formatBRL(h.outflow)}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CashSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, today, setCash, requireWrite } = useStore();
  const toast = useToast();
  const [balance, setBalance] = useState("");
  const [date, setDate] = useState(today);
  const [pix, setPix] = useState("");
  const [err, setErr] = useState("");
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setBalance(data.cash ? amountToInput(data.cash.balance) : "");
      setDate(today);
      setPix(data.cash?.pixKey ?? "");
      setErr("");
    }
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!requireWrite()) return;
    const v = parseBRL(balance.replace(/^-/, ""));
    if (v === undefined) return setErr("Informe um valor, por exemplo 12.500,00.");
    setCash({ balance: balance.trim().startsWith("-") ? -v : v, balanceDate: date, pixKey: pix.trim() || undefined });
    toast("success", "Saldo atualizado.");
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Saldo em caixa"
      description="Some o que a empresa tem hoje nas contas bancárias e no caixa."
      footer={
        <>
          <ModalCloseButton>Cancelar</ModalCloseButton>
          <Button type="submit" form="cash-form">
            Salvar
          </Button>
        </>
      }
    >
      <form id="cash-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Saldo disponível (R$)" htmlFor="cash-bal" required error={err} hint="Se estiver no negativo, comece com o sinal de menos.">
          <Input id="cash-bal" value={balance} inputMode="decimal" className="tabular" onChange={(e) => { setBalance(e.target.value); setErr(""); }} placeholder="0,00" invalid={!!err} data-autofocus />
        </Field>
        <Field label="Saldo do dia" htmlFor="cash-date">
          <Input id="cash-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Chave Pix da empresa" htmlFor="cash-pix" hint="Vai junto nas mensagens de cobrança. Opcional.">
          <Input id="cash-pix" value={pix} onChange={(e) => setPix(e.target.value)} placeholder="CNPJ, e-mail, celular ou chave aleatória" />
        </Field>
      </form>
    </Modal>
  );
}
