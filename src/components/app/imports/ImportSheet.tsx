"use client";

import { useMemo, useRef, useState } from "react";
import { LuCircleAlert, LuCircleCheck, LuFileUp } from "react-icons/lu";
import { formatDate } from "@/lib/dates";
import { formatBRL, normalizeText } from "@/lib/format";
import { buildRows, FIELD_LABEL, guessMapping, parseCSV, type Mapping, type SheetField } from "@/lib/sheetImport";
import { useStore } from "@/lib/store";
import { Button, cx, Modal, ModalCloseButton, Select, useToast } from "../../ui";

const FIELDS: Record<"pagar" | "receber", SheetField[]> = {
  pagar: ["name", "description", "amount", "dueDate", "category", "paidAt"],
  receber: ["name", "description", "amount", "dueDate", "category", "paidAt", "phone"],
};

/** Importar contas a pagar ou a receber de uma planilha CSV. */
export function ImportSheet({ open, onClose, target }: { open: boolean; onClose: () => void; target: "pagar" | "receber" }) {
  const { data, addBill, addReceivable, requireWrite } = useStore();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [table, setTable] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Mapping>({});
  const [error, setError] = useState("");
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTable(null);
      setFileName("");
      setMapping({});
      setError("");
    }
  }

  const headers = table?.[0] ?? [];
  const rows = useMemo(() => (table ? buildRows(table, mapping, target, data.categories) : []), [table, mapping, target, data.categories]);

  // evita importar de novo o que já existe (mesmo nome, valor e vencimento)
  const existing = useMemo(() => {
    const keys = new Set<string>();
    if (target === "pagar") for (const b of data.bills) keys.add(`${normalizeText(b.supplier)}|${b.amount}|${b.dueDate}`);
    else for (const r of data.receivables ?? []) keys.add(`${normalizeText(r.customer)}|${r.amount}|${r.dueDate}`);
    return keys;
  }, [data.bills, data.receivables, target]);
  const isDup = (r: (typeof rows)[number]) => existing.has(`${normalizeText(r.name)}|${r.amount}|${r.dueDate}`);
  const valid = rows.filter((r) => !r.errors.length && !isDup(r));
  const dups = rows.filter((r) => !r.errors.length && isDup(r)).length;
  const invalid = rows.filter((r) => r.errors.length).length;
  const missing = mapping.amount === undefined || mapping.dueDate === undefined || (mapping.name === undefined && mapping.description === undefined);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setError("");
    if (!/\.(csv|txt)$/i.test(f.name) && f.type !== "text/csv") {
      setError("Envie a planilha no formato CSV. No Excel: Arquivo → Salvar como → CSV (separado por vírgulas ou ponto e vírgula).");
      return;
    }
    if (f.size > 5 * 1024 * 1024) return setError("Arquivo muito grande (máximo 5 MB).");
    let text = await f.text();
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(await f.arrayBuffer()); // CSV do Excel em português
    const t = parseCSV(text);
    if (t.length < 2) return setError("Não encontramos linhas na planilha. A primeira linha deve ter os nomes das colunas.");
    setTable(t);
    setFileName(f.name);
    setMapping(guessMapping(t[0]));
  };

  const doImport = () => {
    if (!requireWrite() || !valid.length) return;
    for (const r of valid) {
      if (target === "pagar") {
        addBill({ description: r.description, supplier: r.name, amount: r.amount!, dueDate: r.dueDate!, category: r.category ?? "Outros", paidAt: r.paidAt, source: "manual" });
      } else {
        addReceivable({ description: r.description, customer: r.name, amount: r.amount!, dueDate: r.dueDate!, category: r.category, receivedAt: r.paidAt, customerPhone: r.phone, source: "importado" });
      }
    }
    toast("success", `${valid.length} ${target === "pagar" ? "contas a pagar importadas" : "recebimentos importados"}.`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={target === "pagar" ? "Importar contas a pagar" : "Importar contas a receber"}
      description="Traga as contas da sua planilha. Nada é salvo até você confirmar."
      footer={
        <>
          <ModalCloseButton>Cancelar</ModalCloseButton>
          {table && (
            <Button onClick={doImport} disabled={missing || !valid.length}>
              Importar {valid.length} {valid.length === 1 ? "linha" : "linhas"}
            </Button>
          )}
        </>
      }
    >
      {!table ? (
        <div className="space-y-4">
          <button type="button" onClick={() => input.current?.click()} className="flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-line bg-paper/60 px-6 py-10 text-center transition-colors hover:border-ink/30">
            <span className="grid size-12 place-items-center rounded-full bg-white shadow-sm">
              <LuFileUp className="size-6" />
            </span>
            <span className="font-semibold">Escolher planilha (.csv)</span>
            <span className="text-sm text-muted">No Excel ou Google Planilhas: Arquivo → Salvar como / Fazer download → CSV</span>
          </button>
          <input ref={input} type="file" accept=".csv,text/csv,.txt" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Planilha CSV" />
          {error && (
            <p role="alert" className="rounded-xl bg-overdue-soft px-3 py-2 text-sm font-medium text-overdue">
              {error}
            </p>
          )}
          <div className="rounded-2xl bg-paper px-4 py-3 text-sm text-muted">
            <p className="font-semibold text-ink">A planilha precisa ter, pelo menos:</p>
            <p className="mt-1">uma coluna de {target === "pagar" ? "fornecedor ou descrição" : "cliente ou descrição"}, uma de <strong>valor</strong> e uma de <strong>vencimento</strong> (ex.: 20/10/2026). A primeira linha deve ter os nomes das colunas.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-muted">
            Arquivo: <strong className="text-ink">{fileName}</strong> · {rows.length} linhas
          </p>
          <div>
            <p className="mb-2 text-sm font-semibold">Qual coluna é cada informação?</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {FIELDS[target].map((f) => (
                <label key={f} className="text-xs font-semibold text-muted">
                  {f === "paidAt" && target === "receber" ? "Data do recebimento" : FIELD_LABEL[f]}
                  {(f === "amount" || f === "dueDate") && " *"}
                  <Select
                    className="mt-1"
                    value={mapping[f] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                  >
                    <option value="">— não usar —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Coluna ${i + 1}`}
                      </option>
                    ))}
                  </Select>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-paid-soft px-3 py-1 text-paid">{valid.length} prontas</span>
            {dups > 0 && <span className="rounded-full bg-sky-100 px-3 py-1 text-muted">{dups} já existem (ignoradas)</span>}
            {invalid > 0 && <span className="rounded-full bg-overdue-soft px-3 py-1 text-overdue">{invalid} com problema (ignoradas)</span>}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-paper/70 text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2">Linha</th>
                  <th className="px-3 py-2">{target === "pagar" ? "Fornecedor" : "Cliente"}</th>
                  <th className="px-3 py-2">Vencimento</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.slice(0, 8).map((r) => (
                  <tr key={r.line} className={cx(r.errors.length > 0 && "bg-overdue-soft/40")}>
                    <td className="px-3 py-2 text-muted tabular">{r.line}</td>
                    <td className="max-w-[220px] truncate px-3 py-2">
                      <span className="font-medium">{r.name || "—"}</span>
                      {r.description !== r.name && <span className="block truncate text-xs text-muted">{r.description}</span>}
                    </td>
                    <td className="px-3 py-2 tabular">{r.dueDate ? formatDate(r.dueDate) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular">{r.amount !== undefined ? formatBRL(r.amount) : "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.errors.length ? (
                        <span className="inline-flex items-center gap-1 text-overdue">
                          <LuCircleAlert className="size-3.5" /> {r.errors.join(", ")}
                        </span>
                      ) : isDup(r) ? (
                        <span className="text-muted">já existe</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-paid">
                          <LuCircleCheck className="size-3.5" /> {r.paidAt ? (target === "pagar" ? "paga" : "recebida") : "ok"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 8 && <p className="text-xs text-muted">Mostrando 8 de {rows.length} linhas.</p>}
          {missing && <p className="text-sm font-medium text-overdue">Escolha as colunas de valor, vencimento e {target === "pagar" ? "fornecedor ou descrição" : "cliente ou descrição"}.</p>}
          <button type="button" className="text-sm font-semibold underline" onClick={() => setTable(null)}>
            Escolher outro arquivo
          </button>
        </div>
      )}
    </Modal>
  );
}
