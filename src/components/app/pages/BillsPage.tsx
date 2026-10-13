"use client";

import { useEffect, useMemo, useState } from "react";
import { LuArrowDown, LuArrowUp, LuCircleCheck, LuDownload, LuFileUp, LuFilterX, LuPaperclip, LuPencil, LuPlus, LuRotateCcw, LuSearch, LuTrash2, LuReceipt } from "react-icons/lu";
import { toCSV, downloadText } from "@/lib/csv";
import { addDays, endOfMonth, formatDate, addMonthsClamped, startOfMonth } from "@/lib/dates";
import { CATEGORIES, STATUS_LABEL } from "@/lib/domain";
import { formatBRL, normalizeText, onlyDigits } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { BillStatus } from "@/lib/types";
import { Button, cx, EmptyState, IconButton, Input, PageHeader, Segmented, Select, useToast } from "../../ui";
import { useBillActions } from "../bills/BillActions";
import type { Route } from "../routing";
import { DueText, StatusBadge, sumAmount, useDerived } from "../shared";

type StatusFilter = "todas" | "abertas" | "pendente" | "vencido" | "7dias" | "pago";
type Period = "todos" | "mes" | "proximo" | "30dias" | "personalizado";
type SortKey = "dueDate" | "amount";

export function BillsPage({ route }: { route: Route }) {
  const { today } = useStore();
  const { withStatus } = useDerived();
  const actions = useBillActions();
  const toast = useToast();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todas");
  const [category, setCategory] = useState("");
  const [period, setPeriod] = useState<Period>("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "dueDate", dir: "asc" });

  useEffect(() => {
    const s = route.params.get("status") as StatusFilter | null;
    if (s && ["todas", "abertas", "pendente", "vencido", "7dias", "pago"].includes(s)) setStatus(s);
  }, [route]);

  const range = useMemo((): [string, string] | null => {
    if (period === "mes") return [startOfMonth(today), endOfMonth(today)];
    if (period === "proximo") {
      const n = addMonthsClamped(startOfMonth(today), 1, 1);
      return [n, endOfMonth(n)];
    }
    if (period === "30dias") return [today, addDays(today, 30)];
    if (period === "personalizado" && (from || to)) return [from || "0000-01-01", to || "9999-12-31"];
    return null;
  }, [period, from, to, today]);

  const matchStatus = (s: BillStatus, due: string) => {
    switch (status) {
      case "todas":
        return true;
      case "abertas":
        return s !== "pago";
      case "7dias":
        return s === "pendente" && due <= addDays(today, 7);
      default:
        return s === status;
    }
  };

  const filtered = useMemo(() => {
    const nq = normalizeText(q);
    const dq = onlyDigits(q);
    return withStatus
      .filter(({ bill, status: s }) => {
        if (!matchStatus(s, bill.dueDate)) return false;
        if (category && bill.category !== category) return false;
        if (range && (bill.dueDate < range[0] || bill.dueDate > range[1])) return false;
        if (nq) {
          const hay = normalizeText([bill.description, bill.supplier, bill.documentNumber, bill.notes, bill.category, bill.pixKey].join(" "));
          const digitHit = dq.length >= 4 && (onlyDigits(bill.digitableLine).includes(dq) || onlyDigits(bill.supplierCnpj).includes(dq));
          if (!hay.includes(nq) && !digitHit) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const d = sort.key === "amount" ? a.bill.amount - b.bill.amount : a.bill.dueDate.localeCompare(b.bill.dueDate);
        return sort.dir === "asc" ? d : -d;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withStatus, q, status, category, range, sort, today]);

  const counts = useMemo(() => {
    const c = { todas: withStatus.length, abertas: 0, pendente: 0, vencido: 0, "7dias": 0, pago: 0 };
    for (const { bill, status: s } of withStatus) {
      c[s]++;
      if (s !== "pago") c.abertas++;
      if (s === "pendente" && bill.dueDate <= addDays(today, 7)) c["7dias"]++;
    }
    return c;
  }, [withStatus, today]);

  const hasFilters = !!(q || status !== "todas" || category || period !== "todos");
  const clear = () => {
    setQ("");
    setStatus("todas");
    setCategory("");
    setPeriod("todos");
    setFrom("");
    setTo("");
  };

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "amount" ? "desc" : "asc" }));
  const SortIcon = ({ k }: { k: SortKey }) => (sort.key === k ? sort.dir === "asc" ? <LuArrowUp className="size-3.5" /> : <LuArrowDown className="size-3.5" /> : null);

  const exportCsv = () => {
    const csv = toCSV(
      ["Descrição", "Fornecedor", "CNPJ", "Categoria", "Vencimento", "Valor", "Status", "Data de pagamento", "Nº documento", "Linha digitável", "Chave Pix", "Observações"],
      filtered.map(({ bill, status: s }) => [bill.description, bill.supplier, bill.supplierCnpj, bill.category, formatDate(bill.dueDate), bill.amount, STATUS_LABEL[s], bill.paidAt ? formatDate(bill.paidAt) : "", bill.documentNumber, bill.digitableLine, bill.pixKey, bill.notes]),
    );
    downloadText(`luma-contas-${today}.csv`, csv);
    toast("success", `${filtered.length} contas exportadas em CSV.`);
  };

  return (
    <div>
      <PageHeader
        title="Contas a pagar"
        description="Cadastre, acompanhe e registre pagamentos. As contas vencidas são identificadas automaticamente."
        actions={
          <>
            <Button variant="secondary" icon={<LuDownload className="size-4" />} onClick={exportCsv} disabled={!filtered.length}>
              Exportar CSV
            </Button>
            <Button variant="secondary" icon={<LuFileUp className="size-4" />} onClick={actions.importBoleto}>
              Importar boleto
            </Button>
            <Button icon={<LuPlus className="size-4" />} onClick={() => actions.newBill()}>
              Nova conta
            </Button>
          </>
        }
      />

      <div className="card mb-4 space-y-3 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <LuSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por descrição, fornecedor, nº do documento, linha digitável ou chave Pix" className="pl-9" aria-label="Buscar contas" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filtrar por categoria" className="sm:w-52">
              <option value="">Todas as categorias</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Filtrar por vencimento" className="sm:w-48">
              <option value="todos">Qualquer vencimento</option>
              <option value="mes">Vence este mês</option>
              <option value="proximo">Vence no próximo mês</option>
              <option value="30dias">Próximos 30 dias</option>
              <option value="personalizado">Período personalizado</option>
            </Select>
          </div>
        </div>
        {period === "personalizado" && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Vencimento de</span>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" aria-label="Data inicial" />
            <span className="text-muted">até</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" aria-label="Data final" />
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented
            label="Filtrar por status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "todas", label: "Todas", count: counts.todas },
              { value: "abertas", label: "Em aberto", count: counts.abertas },
              { value: "vencido", label: "Vencidas", count: counts.vencido },
              { value: "7dias", label: "Próx. 7 dias", count: counts["7dias"] },
              { value: "pendente", label: "Pendentes", count: counts.pendente },
              { value: "pago", label: "Pagas", count: counts.pago },
            ]}
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" icon={<LuFilterX className="size-4" />} onClick={clear}>
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          withStatus.length === 0 ? (
            <EmptyState
              icon={<LuReceipt className="size-6" />}
              title="Nenhuma conta cadastrada"
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => actions.newBill()}>Cadastrar conta</Button>
                  <Button variant="secondary" onClick={actions.importBoleto}>
                    Importar boleto
                  </Button>
                </div>
              }
            >
              Cadastre manualmente ou importe um boleto em PDF.
            </EmptyState>
          ) : (
            <EmptyState icon={<LuSearch className="size-6" />} title="Nenhuma conta encontrada" action={<Button variant="secondary" onClick={clear}>Limpar filtros</Button>}>
              Ajuste a busca ou os filtros para ver mais resultados.
            </EmptyState>
          )
        ) : (
          <>
            {/* Tabela (desktop) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper/70 text-left text-xs font-semibold text-muted">
                    <th className="px-5 py-3">Conta</th>
                    <th className="px-3 py-3">Categoria</th>
                    <th className="px-3 py-3">
                      <button className="inline-flex items-center gap-1 hover:text-ink" onClick={() => toggleSort("dueDate")}>
                        Vencimento <SortIcon k="dueDate" />
                      </button>
                    </th>
                    <th className="px-3 py-3 text-right">
                      <button className="inline-flex items-center gap-1 hover:text-ink" onClick={() => toggleSort("amount")}>
                        Valor <SortIcon k="amount" />
                      </button>
                    </th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-5 py-3 text-right">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map(({ bill, status: s }) => (
                    <tr key={bill.id} className="group cursor-pointer hover:bg-sky-50/50" onClick={() => actions.viewBill(bill.id)}>
                      <td className="max-w-[300px] px-5 py-3">
                        <p className="flex items-center gap-1.5 truncate font-semibold">
                          {bill.description}
                          {bill.attachment && <LuPaperclip className="size-3.5 shrink-0 text-muted" aria-label="Com anexo" />}
                        </p>
                        <p className="truncate text-xs text-muted">{bill.supplier}</p>
                      </td>
                      <td className="px-3 py-3 text-[13px] text-slate-600">{bill.category}</td>
                      <td className="px-3 py-3">
                        <DueText bill={bill} today={today} />
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular">{formatBRL(bill.amount)}</td>
                      <td className="px-3 py-3">
                        <StatusBadge bill={bill} today={today} />
                      </td>
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-0.5">
                          {s === "pago" ? (
                            <IconButton label="Reabrir conta" onClick={() => actions.reopen(bill)}>
                              <LuRotateCcw className="size-4" />
                            </IconButton>
                          ) : (
                            <IconButton label="Marcar como paga" onClick={() => actions.payBill(bill)} className="hover:!bg-paid-soft hover:!text-paid">
                              <LuCircleCheck className="size-4" />
                            </IconButton>
                          )}
                          <IconButton label="Editar" onClick={() => actions.editBill(bill)}>
                            <LuPencil className="size-4" />
                          </IconButton>
                          <IconButton label="Excluir" onClick={() => actions.remove(bill)} className="hover:!bg-overdue-soft hover:!text-overdue">
                            <LuTrash2 className="size-4" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Lista (celular) */}
            <ul className="divide-y divide-line md:hidden">
              {filtered.map(({ bill, status: s }) => (
                <li key={bill.id} className="flex items-start gap-3 px-4 py-3.5">
                  <button className="min-w-0 flex-1 text-left" onClick={() => actions.viewBill(bill.id)}>
                    <p className="truncate text-sm font-semibold">{bill.description}</p>
                    <p className="truncate text-xs text-muted">{bill.supplier}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge bill={bill} today={today} />
                      <span className="text-xs text-muted tabular">{formatDate(bill.dueDate)}</span>
                    </div>
                  </button>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-sm font-semibold tabular">{formatBRL(bill.amount)}</span>
                    {s === "pago" ? (
                      <Button size="sm" variant="secondary" onClick={() => actions.reopen(bill)}>
                        Reabrir
                      </Button>
                    ) : (
                      <Button size="sm" variant="soft" onClick={() => actions.payBill(bill)}>
                        Pagar
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className={cx("flex flex-wrap items-center justify-between gap-2 border-t border-line bg-paper/60 px-5 py-3 text-sm")}>
              <span className="text-muted">
                {filtered.length} {filtered.length === 1 ? "conta" : "contas"}
              </span>
              <span>
                Total: <strong className="tabular">{formatBRL(sumAmount(filtered))}</strong>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
