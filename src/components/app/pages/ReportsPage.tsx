"use client";

import { useMemo, useState } from "react";
import { LuDownload, LuPrinter } from "react-icons/lu";
import { downloadText, toCSV } from "@/lib/csv";
import { addMonthsClamped, endOfMonth, formatDate, monthKey, monthLabel, startOfMonth } from "@/lib/dates";
import { billStatus, STATUS_LABEL } from "@/lib/domain";
import { formatBRL } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { BillStatus } from "@/lib/types";
import { CategoryBars, StackedBars } from "../../charts/Charts";
import { Button, cx, Input, PageHeader, Segmented, Select, useToast } from "../../ui";
import { useBillActions } from "../bills/BillActions";
import { StatusBadge } from "../shared";

type Preset = "mes" | "mes_anterior" | "trimestre" | "6meses" | "ano" | "personalizado";

export function ReportsPage() {
  const { data, today } = useStore();
  const actions = useBillActions();
  const toast = useToast();
  const [preset, setPreset] = useState<Preset>("6meses");
  const [customFrom, setCustomFrom] = useState(startOfMonth(today));
  const [customTo, setCustomTo] = useState(endOfMonth(today));
  const [tab, setTab] = useState<"todas" | BillStatus>("todas");

  const [from, to] = useMemo((): [string, string] => {
    const m0 = startOfMonth(today);
    switch (preset) {
      case "mes":
        return [m0, endOfMonth(today)];
      case "mes_anterior": {
        const p = addMonthsClamped(m0, -1, 1);
        return [p, endOfMonth(p)];
      }
      case "trimestre":
        return [addMonthsClamped(m0, -2, 1), endOfMonth(today)];
      case "6meses":
        return [addMonthsClamped(m0, -5, 1), endOfMonth(today)];
      case "ano":
        return [`${today.slice(0, 4)}-01-01`, `${today.slice(0, 4)}-12-31`];
      default:
        return [customFrom || "0000-01-01", customTo || "9999-12-31"];
    }
  }, [preset, customFrom, customTo, today]);

  const rows = useMemo(
    () =>
      data.bills
        .filter((b) => b.dueDate >= from && b.dueDate <= to)
        .map((b) => ({ bill: b, status: billStatus(b, today) }))
        .sort((a, b) => a.bill.dueDate.localeCompare(b.bill.dueDate)),
    [data.bills, from, to, today],
  );

  const sum = (s?: BillStatus) => rows.filter((r) => !s || r.status === s).reduce((a, r) => a + r.bill.amount, 0);
  const count = (s?: BillStatus) => rows.filter((r) => !s || r.status === s).length;

  const months = useMemo(() => {
    const keys: string[] = [];
    if (from.startsWith("0000") || to.startsWith("9999")) {
      for (const r of rows) if (!keys.includes(monthKey(r.bill.dueDate))) keys.push(monthKey(r.bill.dueDate));
      keys.sort();
    } else {
      let k = startOfMonth(from);
      for (let i = 0; i < 36 && k <= to; i++) {
        keys.push(monthKey(k));
        k = addMonthsClamped(k, 1, 1);
      }
    }
    return keys.map((key) => {
      const inM = rows.filter((r) => monthKey(r.bill.dueDate) === key);
      const s = (st: BillStatus) => inM.filter((r) => r.status === st).reduce((a, r) => a + r.bill.amount, 0);
      return { key, label: monthLabel(key), title: monthLabel(key, false), pago: s("pago"), vencido: s("vencido"), pendente: s("pendente"), total: inM.reduce((a, r) => a + r.bill.amount, 0) };
    });
  }, [rows, from, to]);

  const categories = useMemo(() => {
    const m = new Map<string, { value: number; count: number; paid: number }>();
    for (const r of rows) {
      const c = m.get(r.bill.category) ?? { value: 0, count: 0, paid: 0 };
      c.value += r.bill.amount;
      c.count++;
      if (r.status === "pago") c.paid += r.bill.amount;
      m.set(r.bill.category, c);
    }
    return Array.from(m, ([label, v]) => ({ label, ...v })).sort((a, b) => b.value - a.value);
  }, [rows]);

  const listed = rows.filter((r) => tab === "todas" || r.status === tab);
  const periodLabel = `${formatDate(from.startsWith("0000") ? rows[0]?.bill.dueDate : from)} a ${formatDate(to.startsWith("9999") ? rows[rows.length - 1]?.bill.dueDate : to)}`;

  const exportBills = () => {
    downloadText(
      `luma-relatorio-contas-${from}-${to}.csv`,
      toCSV(
        ["Vencimento", "Descrição", "Fornecedor", "Categoria", "Valor", "Status", "Data de pagamento", "Nº documento"],
        listed.map(({ bill, status }) => [formatDate(bill.dueDate), bill.description, bill.supplier, bill.category, bill.amount, STATUS_LABEL[status], bill.paidAt ? formatDate(bill.paidAt) : "", bill.documentNumber]),
      ),
    );
    toast("success", "Relatório de contas exportado.");
  };
  const exportCategories = () => {
    downloadText(`luma-relatorio-categorias-${from}-${to}.csv`, toCSV(["Categoria", "Quantidade", "Total", "Pago", "Participação (%)"], categories.map((c) => [c.label, String(c.count), c.value, c.paid, sum() ? (c.value / sum()) * 100 : 0])));
    toast("success", "Relatório por categoria exportado.");
  };
  const exportMonths = () => {
    downloadText(`luma-relatorio-mensal-${from}-${to}.csv`, toCSV(["Mês", "Pago", "Vencido", "A vencer", "Total"], months.map((m) => [m.title, m.pago, m.vencido, m.pendente, m.total])));
    toast("success", "Evolução mensal exportada.");
  };

  return (
    <div className="print-area">
      <PageHeader
        title="Relatórios"
        description={<>Despesas pelo mês de vencimento. Período: <strong className="text-ink">{rows.length ? periodLabel : "sem contas no período"}</strong></>}
        actions={
          <>
            <Button variant="secondary" icon={<LuPrinter className="size-4" />} onClick={() => window.print()}>
              Imprimir
            </Button>
            <Button variant="secondary" icon={<LuDownload className="size-4" />} onClick={exportBills} disabled={!listed.length}>
              Exportar contas (CSV)
            </Button>
          </>
        }
      />

      <div className="no-print card mb-6 flex flex-wrap items-center gap-2 p-3 sm:p-4">
        <Select value={preset} onChange={(e) => setPreset(e.target.value as Preset)} aria-label="Período" className="w-auto">
          <option value="mes">Este mês</option>
          <option value="mes_anterior">Mês anterior</option>
          <option value="trimestre">Últimos 3 meses</option>
          <option value="6meses">Últimos 6 meses</option>
          <option value="ano">Este ano</option>
          <option value="personalizado">Período personalizado</option>
        </Select>
        {preset === "personalizado" && (
          <>
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-auto" aria-label="De" />
            <span className="text-sm text-muted">até</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-auto" aria-label="Até" />
          </>
        )}
      </div>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {(
          [
            ["Total no período", sum(), count(), "text-ink"],
            ["Pagas", sum("pago"), count("pago"), "text-paid"],
            ["Pendentes", sum("pendente"), count("pendente"), "text-navy-600"],
            ["Vencidas", sum("vencido"), count("vencido"), "text-overdue"],
          ] as const
        ).map(([label, value, n, cls]) => (
          <div key={label} className="card p-4">
            <p className="text-[13px] font-semibold text-muted">{label}</p>
            <p className={cx("mt-1 font-display text-xl font-semibold tabular sm:text-2xl", cls)}>{formatBRL(value)}</p>
            <p className="text-xs text-muted">
              {n} {n === 1 ? "conta" : "contas"}
            </p>
          </div>
        ))}
      </section>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <section className="card p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold">Evolução mensal</h2>
            <Button size="sm" variant="ghost" className="no-print" icon={<LuDownload className="size-3.5" />} onClick={exportMonths} disabled={!months.length}>
              CSV
            </Button>
          </div>
          {months.length ? (
            <StackedBars
              data={months.map((m) => ({ label: m.label, title: m.title, highlight: m.key === monthKey(today), segments: [{ key: "pago", value: m.pago }, { key: "vencido", value: m.vencido }, { key: "aberto", value: m.pendente }] }))}
              series={[
                { key: "pago", label: "Pago", color: "#111111" },
                { key: "vencido", label: "Vencido", color: "#cf3f3c" },
                { key: "aberto", label: "A vencer", color: "#c7c5bb" },
              ]}
            />
          ) : (
            <p className="text-sm text-muted">Sem dados no período.</p>
          )}
        </section>
        <section className="card p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold">Despesas por categoria</h2>
            <Button size="sm" variant="ghost" className="no-print" icon={<LuDownload className="size-3.5" />} onClick={exportCategories} disabled={!categories.length}>
              CSV
            </Button>
          </div>
          {categories.length ? <CategoryBars data={categories} limit={8} /> : <p className="text-sm text-muted">Sem dados no período.</p>}
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <h2 className="font-display text-base font-semibold">Contas do período</h2>
          <div className="no-print">
            <Segmented
              label="Status"
              value={tab}
              onChange={setTab}
              options={[
                { value: "todas", label: "Todas", count: count() },
                { value: "pago", label: "Pagas", count: count("pago") },
                { value: "pendente", label: "Pendentes", count: count("pendente") },
                { value: "vencido", label: "Vencidas", count: count("vencido") },
              ]}
            />
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-y border-line bg-paper/70 text-left text-xs font-semibold text-muted">
                <th className="px-5 py-2.5">Vencimento</th>
                <th className="px-3 py-2.5">Conta</th>
                <th className="px-3 py-2.5">Categoria</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-5 py-2.5 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {listed.map(({ bill }) => (
                <tr key={bill.id} className="cursor-pointer hover:bg-sky-50/50" onClick={() => actions.viewBill(bill.id)}>
                  <td className="px-5 py-2.5 tabular">{formatDate(bill.dueDate)}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-medium">{bill.description}</span>
                    <span className="block text-xs text-muted">{bill.supplier}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[13px] text-slate-600">{bill.category}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge bill={bill} today={today} />
                  </td>
                  <td className="px-5 py-2.5 text-right font-semibold tabular">{formatBRL(bill.amount)}</td>
                </tr>
              ))}
              {!listed.length && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-muted">
                    Nenhuma conta neste filtro.
                  </td>
                </tr>
              )}
            </tbody>
            {listed.length > 0 && (
              <tfoot>
                <tr className="border-t border-line bg-paper/60 font-semibold">
                  <td className="px-5 py-3" colSpan={4}>
                    Total ({listed.length})
                  </td>
                  <td className="px-5 py-3 text-right tabular">{formatBRL(listed.reduce((a, r) => a + r.bill.amount, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
      <p className="mt-4 hidden text-xs text-muted print:block">Relatório gerado pela Luma (versão demonstrativa) em {formatDate(today)}.</p>
    </div>
  );
}
