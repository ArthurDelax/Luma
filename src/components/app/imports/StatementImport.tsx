"use client";

import { useMemo, useRef, useState } from "react";
import { LuArrowDownLeft, LuArrowUpRight, LuFileUp, LuLandmark } from "react-icons/lu";
import { formatDate } from "@/lib/dates";
import { formatBRL } from "@/lib/format";
import { matchStatement, MATCH_WINDOW, parseOFX, type StatementTx } from "@/lib/ofx";
import { useStore } from "@/lib/store";
import { Button, cx, Modal, ModalCloseButton, useToast } from "../../ui";

/** Botão + janela: importar extrato OFX e dar baixa automática nas contas. */
export function StatementImportButton({ variant = "secondary" }: { variant?: "secondary" | "primary" }) {
  const { requireWrite } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} icon={<LuLandmark className="size-4" />} onClick={() => requireWrite() && setOpen(true)}>
        Importar extrato
      </Button>
      <StatementImport open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function StatementImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, markPaid, markReceived, requireWrite } = useStore();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [txs, setTxs] = useState<StatementTx[] | null>(null);
  const [error, setError] = useState("");
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTxs(null);
      setError("");
      setSkip(new Set());
    }
  }

  const result = useMemo(() => (txs ? matchStatement(txs, data.bills, data.receivables ?? []) : null), [txs, data.bills, data.receivables]);
  const chosen = result ? result.matches.filter((m) => !skip.has(m.tx.id)) : [];

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setError("");
    if (f.size > 10 * 1024 * 1024) return setError("Arquivo muito grande (máximo 10 MB).");
    const text = await f.text();
    const list = parseOFX(text);
    if (!list.length) return setError("Não encontramos movimentos neste arquivo. Baixe o extrato no formato OFX (às vezes chamado de \"Money\" ou \"Quicken\") no internet banking.");
    setTxs(list);
  };

  const apply = () => {
    if (!requireWrite() || !chosen.length) return;
    for (const m of chosen) {
      if (m.kind === "pagar") markPaid(m.targetId, m.tx.date);
      else markReceived(m.targetId, m.tx.date);
    }
    const p = chosen.filter((m) => m.kind === "pagar").length;
    const r = chosen.length - p;
    toast("success", [p && `${p} ${p === 1 ? "conta paga" : "contas pagas"}`, r && `${r} ${r === 1 ? "recebimento" : "recebimentos"}`].filter(Boolean).join(" e ") + " registrados pelo extrato.");
    onClose();
  };

  const period = txs?.length ? `${formatDate(txs[0].date)} a ${formatDate(txs[txs.length - 1].date)}` : "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Importar extrato do banco"
      description="A Luma encontra no extrato o que já foi pago ou recebido e dá baixa nas contas para você."
      footer={
        <>
          <ModalCloseButton>Cancelar</ModalCloseButton>
          {result && (
            <Button onClick={apply} disabled={!chosen.length}>
              Dar baixa em {chosen.length} {chosen.length === 1 ? "conta" : "contas"}
            </Button>
          )}
        </>
      }
    >
      {!result ? (
        <div className="space-y-4">
          <button type="button" onClick={() => input.current?.click()} className="flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-line bg-paper/60 px-6 py-10 text-center transition-colors hover:border-ink/30">
            <span className="grid size-12 place-items-center rounded-full bg-white shadow-sm">
              <LuFileUp className="size-6" />
            </span>
            <span className="font-semibold">Escolher extrato (.ofx)</span>
            <span className="text-sm text-muted">No internet banking, procure por &quot;Exportar extrato&quot; e escolha o formato OFX.</span>
          </button>
          <input ref={input} type="file" accept=".ofx,.OFX,application/x-ofx,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Extrato OFX" />
          {error && (
            <p role="alert" className="rounded-xl bg-overdue-soft px-3 py-2 text-sm font-medium text-overdue">
              {error}
            </p>
          )}
          <p className="rounded-2xl bg-paper px-4 py-3 text-sm text-muted">
            O arquivo é lido aqui no seu navegador e não é enviado para lugar nenhum. A Luma compara valor e data (até {MATCH_WINDOW} dias do vencimento) e você confere antes de confirmar.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-muted">
            {txs!.length} movimentos de {period}. Encontramos <strong className="text-ink">{result.matches.length}</strong> {result.matches.length === 1 ? "conta correspondente" : "contas correspondentes"}.
          </p>
          {result.matches.length > 0 && (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {result.matches.map((m) => {
                const on = !skip.has(m.tx.id);
                return (
                  <li key={m.tx.id}>
                    <label className={cx("flex cursor-pointer items-center gap-3 px-4 py-3", !on && "opacity-50")}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setSkip((s) => { const n = new Set(s); if (n.has(m.tx.id)) n.delete(m.tx.id); else n.add(m.tx.id); return n; })}
                        className="size-4 accent-[#111]"
                      />
                      <span className={cx("grid size-7 shrink-0 place-items-center rounded-full", m.kind === "receber" ? "bg-paid-soft text-paid" : "bg-overdue-soft text-overdue")}>
                        {m.kind === "receber" ? <LuArrowDownLeft className="size-4" /> : <LuArrowUpRight className="size-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{m.label}</span>
                        <span className="block truncate text-xs text-muted">
                          Extrato {formatDate(m.tx.date)}: {m.tx.memo}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold tabular">{formatBRL(Math.abs(m.tx.amount))}</span>
                        <span className="block text-[11px] text-muted">{m.kind === "pagar" ? "marcar paga" : "marcar recebida"}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {result.unmatched.length > 0 && (
            <details className="rounded-2xl bg-paper px-4 py-3 text-sm">
              <summary className="cursor-pointer font-semibold">{result.unmatched.length} movimentos sem conta na Luma</summary>
              <p className="mt-1 text-xs text-muted">Podem ser tarifas, transferências ou contas que ainda não foram cadastradas.</p>
              <ul className="mt-2 space-y-1">
                {result.unmatched.slice(0, 30).map((t) => (
                  <li key={t.id} className="flex justify-between gap-3 text-xs">
                    <span className="truncate">
                      {formatDate(t.date)} · {t.memo}
                    </span>
                    <span className={cx("shrink-0 tabular", t.amount > 0 ? "text-paid" : "text-ink")}>{formatBRL(t.amount)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button type="button" className="text-sm font-semibold underline" onClick={() => setTxs(null)}>
            Escolher outro arquivo
          </button>
        </div>
      )}
    </Modal>
  );
}
