"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { LuCircleCheck, LuCopy, LuFileText, LuPencil, LuRotateCcw, LuTrash2 } from "react-icons/lu";
import { openAttachment } from "@/lib/attachments";
import type { ExtractedBoleto } from "@/lib/boleto/extract";
import { formatLinha, isParseError, parseLinhaDigitavel } from "@/lib/boleto/linha";
import { classifyPixKey, formatPixKey, parsePixPayload, PIX_KEY_TYPE_LABEL } from "@/lib/boleto/pix";
import { formatDate, todayISO } from "@/lib/dates";
import { billStatus, FREQUENCY_LABEL, type Occurrence } from "@/lib/domain";
import { formatBRL, formatCNPJ, formatFileSize } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Bill } from "@/lib/types";
import { Badge, Button, Input, Modal, useConfirm, useToast } from "../../ui";
import { StatusBadge } from "../shared";
import { BillEditor, type BillDraft } from "./BillEditor";
import { ImportBoleto } from "./ImportBoleto";

interface BillActions {
  newBill(prefill?: BillDraft): void;
  editBill(bill: Bill): void;
  viewBill(id: string): void;
  importBoleto(): void;
  launchOccurrence(o: Occurrence): void;
  payBill(bill: Bill): void;
  reopen(bill: Bill): void;
  remove(bill: Bill): Promise<boolean>;
}

const Ctx = createContext<BillActions | null>(null);

export function useBillActions() {
  const c = useContext(Ctx);
  if (!c) throw new Error("BillActionsProvider ausente");
  return c;
}

export function BillActionsProvider({ children }: { children: ReactNode }) {
  const { data, today, markPaid, reopenBill, deleteBill, addBill } = useStore();
  const toast = useToast();
  const confirm = useConfirm();
  const [editor, setEditor] = useState<{ draft: BillDraft; extraction?: ExtractedBoleto; file?: File; key: number } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [paying, setPaying] = useState<Bill | null>(null);
  const [payDate, setPayDate] = useState(todayISO());

  const payBill = useCallback((bill: Bill) => {
    setPayDate(todayISO());
    setPaying(bill);
  }, []);

  const reopen = useCallback(
    (bill: Bill) => {
      reopenBill(bill.id);
      toast("info", "Conta reaberta.", { label: "Desfazer", onClick: () => markPaid(bill.id, bill.paidAt) });
    },
    [reopenBill, markPaid, toast],
  );

  const remove = useCallback(
    async (bill: Bill) => {
      const ok = await confirm({
        title: "Excluir conta?",
        message: (
          <>
            A conta <strong>{bill.description}</strong> ({formatBRL(bill.amount)}, vencimento {formatDate(bill.dueDate)}) será excluída definitivamente
            {bill.attachment ? ", junto com o PDF anexado" : ""}.
          </>
        ),
        confirmLabel: "Excluir conta",
        danger: true,
      });
      if (ok) {
        deleteBill(bill.id);
        setDetailId(null);
        toast("success", "Conta excluída.");
      }
      return ok;
    },
    [confirm, deleteBill, toast],
  );

  const launchOccurrence = useCallback(
    (o: Occurrence) => {
      const exists = data.bills.some((b) => b.recurringId === o.recurring.id && b.occurrenceDate === o.date);
      if (exists) {
        toast("info", "Esta ocorrência já foi lançada.");
        return;
      }
      addBill({
        description: o.recurring.description,
        supplier: o.recurring.supplier || o.recurring.description,
        amount: o.recurring.amount,
        dueDate: o.date,
        category: o.recurring.category,
        recurringId: o.recurring.id,
        occurrenceDate: o.date,
        source: "recorrente",
      });
      toast("success", `Conta lançada para ${formatDate(o.date)}.`);
    },
    [addBill, data.bills, toast],
  );

  const actions = useMemo<BillActions>(
    () => ({
      newBill: (prefill) => setEditor({ draft: prefill ?? {}, key: Date.now() }),
      editBill: (bill) => {
        setDetailId(null);
        setEditor({ draft: bill, key: Date.now() });
      },
      viewBill: (id) => setDetailId(id),
      importBoleto: () => setImportOpen(true),
      launchOccurrence,
      payBill,
      reopen,
      remove,
    }),
    [launchOccurrence, payBill, reopen, remove],
  );

  const detail = detailId ? data.bills.find((b) => b.id === detailId) : undefined;

  return (
    <Ctx.Provider value={actions}>
      {children}

      <ImportBoleto
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onManual={() => {
          setImportOpen(false);
          setEditor({ draft: {}, key: Date.now() });
        }}
        onExtracted={(file, result) => {
          setImportOpen(false);
          const desc = result.description ?? (result.supplier ? `Boleto — ${result.supplier}` : file.name.replace(/\.pdf$/i, ""));
          setEditor({
            key: Date.now(),
            file,
            extraction: result,
            draft: {
              description: desc.slice(0, 140),
              category: result.category,
              supplier: result.supplier,
              supplierCnpj: result.supplierCnpj,
              payer: result.payer,
              amount: result.amount,
              dueDate: result.dueDate,
              digitableLine: result.digitableLine,
              documentNumber: result.documentNumber,
              bank: result.bank,
              pixKey: result.pixKey,
              pixCopiaECola: result.pixCopiaECola,
              source: "boleto",
            },
          });
        }}
      />

      {editor && <BillEditor key={editor.key} open onClose={() => setEditor(null)} initial={editor.draft} extraction={editor.extraction} pendingFile={editor.file} />}

      {detail && <BillDetail bill={detail} today={today} onClose={() => setDetailId(null)} actions={actions} recurringName={data.recurring.find((r) => r.id === detail.recurringId)} />}

      <Modal
        open={!!paying}
        onClose={() => setPaying(null)}
        size="sm"
        title="Marcar como paga"
        description={paying ? `${paying.description} · ${formatBRL(paying.amount)}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPaying(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!paying) return;
                const id = paying.id;
                markPaid(id, payDate || todayISO());
                setPaying(null);
                toast("success", "Pagamento registrado.", { label: "Desfazer", onClick: () => reopenBill(id) });
              }}
            >
              Confirmar pagamento
            </Button>
          </>
        }
      >
        <label className="text-[13px] font-semibold" htmlFor="pay-date">
          Data do pagamento
        </label>
        <Input id="pay-date" type="date" className="mt-1.5" value={payDate} max={todayISO()} onChange={(e) => setPayDate(e.target.value)} />
        <p className="mt-2 text-xs text-muted">Registro interno da Luma — nenhum pagamento é realizado.</p>
      </Modal>
    </Ctx.Provider>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9.5rem_1fr] gap-3 border-b border-line/70 py-2.5 text-sm last:border-0 max-sm:grid-cols-1 max-sm:gap-0.5">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{children}</dd>
    </div>
  );
}

function CopyButton({ text, label, done }: { text: string; label: string; done: string }) {
  const toast = useToast();
  return (
    <button
      className="shrink-0 rounded-md p-1 text-muted hover:bg-sky-100 hover:text-ink"
      aria-label={label}
      title={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast("success", done);
        } catch {
          toast("error", "Não foi possível copiar.");
        }
      }}
    >
      <LuCopy className="size-4" />
    </button>
  );
}

function BillDetail({ bill, today, onClose, actions, recurringName }: { bill: Bill; today: string; onClose: () => void; actions: BillActions; recurringName?: { description: string; frequency: keyof typeof FREQUENCY_LABEL } }) {
  const toast = useToast();
  const status = billStatus(bill, today);
  const linha = bill.digitableLine ? parseLinhaDigitavel(bill.digitableLine, today) : null;
  return (
    <Modal
      open
      onClose={onClose}
      title={bill.description}
      description={bill.supplier}
      footer={
        <>
          <Button variant="ghost" className="mr-auto text-overdue hover:bg-overdue-soft" icon={<LuTrash2 className="size-4" />} onClick={() => actions.remove(bill)}>
            Excluir
          </Button>
          <Button variant="secondary" icon={<LuPencil className="size-4" />} onClick={() => actions.editBill(bill)}>
            Editar
          </Button>
          {status === "pago" ? (
            <Button variant="secondary" icon={<LuRotateCcw className="size-4" />} onClick={() => actions.reopen(bill)}>
              Reabrir
            </Button>
          ) : (
            <Button icon={<LuCircleCheck className="size-4" />} onClick={() => actions.payBill(bill)}>
              Marcar como paga
            </Button>
          )}
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="font-display text-3xl font-semibold tabular">{formatBRL(bill.amount)}</span>
        <StatusBadge bill={bill} today={today} />
        {bill.source === "boleto" && <Badge tone="info">Importada de PDF</Badge>}
        {bill.recurringId && <Badge tone="contract">Recorrente</Badge>}
      </div>
      <dl>
        <Row label="Vencimento">{formatDate(bill.dueDate)}</Row>
        {bill.paidAt && <Row label="Pago em">{formatDate(bill.paidAt)}</Row>}
        <Row label="Categoria">{bill.category}</Row>
        <Row label="Fornecedor">{bill.supplier}</Row>
        {bill.supplierCnpj && <Row label="CNPJ">{formatCNPJ(bill.supplierCnpj)}</Row>}
        {bill.documentNumber && <Row label="Nº do documento">{bill.documentNumber}</Row>}
        {bill.bank && <Row label="Banco emissor">{bill.bank}</Row>}
        {bill.payer && <Row label="Pagador">{bill.payer}</Row>}
        {recurringName && <Row label="Despesa recorrente">{`${recurringName.description} (${FREQUENCY_LABEL[recurringName.frequency].toLowerCase()})`}</Row>}
        {bill.digitableLine && (
          <Row label="Linha digitável">
            <div className="flex items-start gap-2">
              <code className="font-mono text-[13px] leading-relaxed">{formatLinha(bill.digitableLine)}</code>
              <button
                className="shrink-0 rounded-md p-1 text-muted hover:bg-sky-100 hover:text-ink"
                aria-label="Copiar linha digitável"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(bill.digitableLine!);
                    toast("success", "Linha digitável copiada.");
                  } catch {
                    toast("error", "Não foi possível copiar.");
                  }
                }}
              >
                <LuCopy className="size-4" />
              </button>
            </div>
            {linha && !isParseError(linha) && (
              <span className={linha.valid ? "text-xs text-paid" : "text-xs text-overdue"}>{linha.valid ? "Dígitos verificadores conferem" : "Dígitos verificadores não conferem"}</span>
            )}
          </Row>
        )}
        {bill.pixKey && (
          <Row label="Chave Pix">
            <div className="flex items-start gap-2">
              <span className="break-all">{formatPixKey(bill.pixKey)}</span>
              <CopyButton text={bill.pixKey} label="Copiar chave Pix" done="Chave Pix copiada." />
            </div>
            {classifyPixKey(bill.pixKey) && <span className="text-xs font-normal text-muted">{PIX_KEY_TYPE_LABEL[classifyPixKey(bill.pixKey)!.type]}</span>}
          </Row>
        )}
        {bill.pixCopiaECola && (
          <Row label="Pix Copia e Cola">
            <div className="flex items-start gap-2">
              <code className="line-clamp-3 break-all font-mono text-[12px] leading-relaxed">{bill.pixCopiaECola}</code>
              <CopyButton text={bill.pixCopiaECola} label="Copiar código Pix" done="Código Pix copiado." />
            </div>
            {(() => {
              const p = parsePixPayload(bill.pixCopiaECola);
              if (!p) return null;
              return (
                <span className={p.crcValid ? "text-xs text-paid" : "text-xs text-overdue"}>
                  {p.crcValid ? "Código íntegro (CRC confere)" : "CRC não confere"}
                  {p.merchantName ? ` · recebedor: ${p.merchantName}` : ""}
                </span>
              );
            })()}
          </Row>
        )}
        {bill.notes && <Row label="Observações"><span className="whitespace-pre-wrap font-normal">{bill.notes}</span></Row>}
        {bill.attachment && (
          <Row label="Anexo">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-[13px] hover:bg-sky-50"
              onClick={async () => {
                const ok = await openAttachment(bill.attachment!);
                if (!ok) toast("error", "O PDF não está mais disponível neste navegador.");
              }}
            >
              <LuFileText className="size-4 text-navy-600" />
              {bill.attachment.name}
              <span className="text-muted">({formatFileSize(bill.attachment.size)})</span>
            </button>
          </Row>
        )}
      </dl>
    </Modal>
  );
}
