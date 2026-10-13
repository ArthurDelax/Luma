"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { LuCircleAlert, LuCircleCheck, LuFileText, LuPaperclip, LuScanText, LuTrash2, LuTriangleAlert } from "react-icons/lu";
import { MAX_ATTACHMENT_BYTES, saveAttachment, deleteAttachment } from "@/lib/attachments";
import { FIELD_LABELS, type ExtractedBoleto, type FieldKey } from "@/lib/boleto/extract";
import { formatLinha, isParseError, parseLinhaDigitavel } from "@/lib/boleto/linha";
import { bankName } from "@/lib/boleto/banks";
import { classifyPixKey, formatPixKey, namesLookRelated, parsePixPayload, PIX_KEY_TYPE_LABEL } from "@/lib/boleto/pix";
import { formatDate, isValidISO } from "@/lib/dates";
import { CATEGORIES, findDuplicates, type DuplicateMatch } from "@/lib/domain";
import { amountToInput, formatBRL, formatCNPJ, formatFileSize, isValidCNPJ, onlyDigits, parseBRL } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { AttachmentMeta, Bill } from "@/lib/types";
import { Badge, Button, cx, Field, Input, Modal, Select, Textarea, useToast } from "../../ui";

export interface BillDraft extends Partial<Bill> {}

interface FormState {
  description: string;
  supplier: string;
  supplierCnpj: string;
  amount: string;
  dueDate: string;
  category: string;
  documentNumber: string;
  digitableLine: string;
  bank: string;
  payer: string;
  pixKey: string;
  pixCopiaECola: string;
  notes: string;
  paid: boolean;
  paidAt: string;
}

function toForm(b: BillDraft, today: string): FormState {
  return {
    description: b.description ?? "",
    supplier: b.supplier ?? "",
    supplierCnpj: b.supplierCnpj ? formatCNPJ(b.supplierCnpj) : "",
    amount: amountToInput(b.amount),
    dueDate: b.dueDate ?? "",
    category: b.category ?? "",
    documentNumber: b.documentNumber ?? "",
    digitableLine: b.digitableLine ? formatLinha(b.digitableLine) : "",
    bank: b.bank ?? "",
    payer: b.payer ?? "",
    pixKey: b.pixKey ? formatPixKey(b.pixKey) : "",
    pixCopiaECola: b.pixCopiaECola ?? "",
    notes: b.notes ?? "",
    paid: !!b.paidAt,
    paidAt: b.paidAt ?? today,
  };
}

type Errors = Partial<Record<keyof FormState, string>>;

export function BillEditor({
  open,
  onClose,
  initial,
  extraction,
  pendingFile,
}: {
  open: boolean;
  onClose: () => void;
  initial: BillDraft;
  extraction?: ExtractedBoleto;
  pendingFile?: File;
}) {
  const { data, today, addBill, updateBill } = useStore();
  const toast = useToast();
  const editing = !!initial.id;
  const [f, setF] = useState<FormState>(() => toForm(initial, today));
  const [errors, setErrors] = useState<Errors>({});
  const [dupes, setDupes] = useState<DuplicateMatch[] | null>(null);
  const [attachment, setAttachment] = useState<AttachmentMeta | undefined>(initial.attachment);
  const [newFile, setNewFile] = useState<File | undefined>(pendingFile);
  const [keepPdf, setKeepPdf] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setF(toForm(initial, today));
      setErrors({});
      setDupes(null);
      setAttachment(initial.attachment);
      setNewFile(pendingFile);
      setKeepPdf(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, pendingFile]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
    setDupes(null);
  };

  const linha = useMemo(() => {
    const d = onlyDigits(f.digitableLine);
    if (!d) return null;
    return parseLinhaDigitavel(d, today);
  }, [f.digitableLine, today]);

  const pix = useMemo(() => (f.pixCopiaECola.trim() ? parsePixPayload(f.pixCopiaECola) : undefined), [f.pixCopiaECola]);
  const keyInfo = useMemo(() => (f.pixKey.trim() ? classifyPixKey(f.pixKey) : undefined), [f.pixKey]);

  const fromPdf = (k: FieldKey) => (extraction?.found[k] ? <Badge tone="info" className="!py-0 !text-[11px]">lido do PDF</Badge> : undefined);

  function validate(): { errors: Errors; bill?: Omit<Bill, "id" | "createdAt" | "updatedAt"> } {
    const e: Errors = {};
    const amount = parseBRL(f.amount);
    if (!f.description.trim()) e.description = "Informe uma descrição.";
    if (!f.supplier.trim()) e.supplier = "Informe a empresa ou fornecedor.";
    if (amount === undefined) e.amount = "Informe um valor válido, por exemplo 1.250,00.";
    else if (amount <= 0) e.amount = "O valor deve ser maior que zero.";
    else if (amount > 100_000_000) e.amount = "Valor muito alto — confira.";
    if (!isValidISO(f.dueDate)) e.dueDate = "Informe a data de vencimento.";
    if (!f.category) e.category = "Escolha uma categoria.";
    if (f.supplierCnpj.trim() && !isValidCNPJ(f.supplierCnpj)) e.supplierCnpj = "CNPJ inválido (dígitos verificadores não conferem).";
    if (onlyDigits(f.digitableLine) && linha && isParseError(linha)) e.digitableLine = linha.error;
    if (f.pixKey.trim() && !classifyPixKey(f.pixKey)) e.pixKey = "Chave Pix inválida. Use CPF, CNPJ, e-mail, celular com +55 ou chave aleatória.";
    if (f.pixCopiaECola.trim() && !pix) e.pixCopiaECola = "Este não parece ser um código Pix Copia e Cola (deve começar com 000201).";
    if (f.paid && !isValidISO(f.paidAt)) e.paidAt = "Informe a data do pagamento.";
    if (Object.keys(e).length) return { errors: e };
    return {
      errors: e,
      bill: {
        description: f.description.trim(),
        supplier: f.supplier.trim(),
        supplierCnpj: onlyDigits(f.supplierCnpj) || undefined,
        amount: amount!,
        dueDate: f.dueDate,
        category: f.category,
        documentNumber: f.documentNumber.trim() || undefined,
        digitableLine: onlyDigits(f.digitableLine) || undefined,
        bank: f.bank.trim() || undefined,
        payer: f.payer.trim() || undefined,
        pixKey: f.pixKey.trim() ? classifyPixKey(f.pixKey)?.key : undefined,
        pixCopiaECola: pix?.raw,
        notes: f.notes.trim() || undefined,
        paidAt: f.paid ? f.paidAt : undefined,
        recurringId: initial.recurringId,
        occurrenceDate: initial.occurrenceDate,
        source: initial.source ?? (extraction ? "boleto" : "manual"),
        attachment,
      },
    };
  }

  async function submit(e: FormEvent, force = false) {
    e.preventDefault();
    const { errors: errs, bill } = validate();
    setErrors(errs);
    if (!bill) {
      toast("error", "Revise os campos destacados.");
      return;
    }
    const matches = findDuplicates({ ...bill, id: initial.id }, data.bills);
    if (matches.some((m) => m.level === "forte")) {
      setDupes(matches);
      return;
    }
    if (matches.length && !force) {
      setDupes(matches);
      return;
    }
    setSaving(true);
    let att = attachment;
    try {
      if (newFile && keepPdf) {
        if (att) await deleteAttachment(att.id);
        att = await saveAttachment(newFile, newFile.name);
      }
    } catch {
      toast("error", "Não foi possível guardar o PDF neste navegador. A conta será salva sem anexo.");
      att = attachment;
    }
    if (editing) {
      updateBill(initial.id!, { ...bill, attachment: att });
      toast("success", "Conta atualizada.");
    } else {
      addBill({ ...bill, attachment: att });
      toast("success", bill.paidAt ? "Conta cadastrada como paga." : "Conta cadastrada.");
    }
    setSaving(false);
    onClose();
  }

  function applyFromLinha() {
    if (!linha || isParseError(linha)) return;
    if (linha.amount !== undefined) set("amount", amountToInput(linha.amount));
    if (linha.dueDate) setF((s) => ({ ...s, dueDate: linha.dueDate! }));
    if (linha.bankCode && linha.kind === "bancario") {
      const n = bankName(linha.bankCode);
      setF((s) => ({ ...s, bank: n ? `${linha.bankCode} – ${n}` : linha.bankCode! }));
    }
  }

  const strong = dupes?.find((d) => d.level === "forte");
  const extractionStatus = extraction
    ? Object.keys(extraction.found).length === 0
      ? "falha"
      : Object.keys(extraction.found).length >= 5 && !extraction.warnings.length
        ? "completa"
        : "parcial"
    : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? "Editar conta" : extraction ? "Conferir dados do boleto" : "Nova conta a pagar"}
      description={extraction ? "Revise e corrija o que for preciso. Nada é salvo até você confirmar." : "Campos com * são obrigatórios."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          {dupes && !strong ? (
            <Button variant="danger" onClick={(e) => submit(e as unknown as FormEvent, true)} disabled={saving}>
              Salvar mesmo assim
            </Button>
          ) : (
            <Button type="submit" form="bill-form" disabled={saving}>
              {saving ? "Salvando…" : editing ? "Salvar alterações" : extraction ? "Confirmar e cadastrar" : "Cadastrar conta"}
            </Button>
          )}
        </>
      }
    >
      <form id="bill-form" onSubmit={(e) => submit(e)} noValidate className="space-y-5">
        {extraction && (
          <div
            className={cx(
              "rounded-xl border p-4",
              extractionStatus === "completa" ? "border-paid/25 bg-paid-soft/60" : extractionStatus === "parcial" ? "border-soon/25 bg-soon-soft/60" : "border-overdue/25 bg-overdue-soft/60",
            )}
          >
            <div className="flex items-start gap-3">
              {extractionStatus === "completa" ? (
                <LuCircleCheck className="mt-0.5 size-5 shrink-0 text-paid" />
              ) : extractionStatus === "parcial" ? (
                <LuScanText className="mt-0.5 size-5 shrink-0 text-soon" />
              ) : (
                <LuCircleAlert className="mt-0.5 size-5 shrink-0 text-overdue" />
              )}
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">
                  {extractionStatus === "completa"
                    ? "Leitura concluída"
                    : extractionStatus === "parcial"
                      ? "Leitura parcial — alguns campos precisam ser preenchidos"
                      : "Não foi possível identificar os dados deste PDF"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(Object.keys(FIELD_LABELS) as FieldKey[]).map((k) => (
                    <span
                      key={k}
                      className={cx(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        extraction.found[k] ? "bg-white text-ink" : "bg-white/50 text-muted line-through decoration-muted/50",
                      )}
                      title={extraction.found[k] ? `Origem: ${extraction.found[k]}` : "Não encontrado"}
                    >
                      {extraction.found[k] ? <LuCircleCheck className="size-3 text-paid" /> : null}
                      {FIELD_LABELS[k]}
                    </span>
                  ))}
                </div>
                {extraction.warnings.length > 0 && (
                  <ul className="mt-2 space-y-1 text-[13px] text-slate-700">
                    {extraction.warnings.map((w) => (
                      <li key={w} className="flex gap-1.5">
                        <LuTriangleAlert className="mt-0.5 size-3.5 shrink-0 text-soon" />
                        {w}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {dupes && (
          <div role="alert" className={cx("rounded-xl border p-4 text-sm", strong ? "border-overdue/30 bg-overdue-soft" : "border-soon/30 bg-soon-soft")}>
            <p className="flex items-center gap-2 font-semibold">
              <LuTriangleAlert className={cx("size-4", strong ? "text-overdue" : "text-soon")} />
              {strong ? "Esta conta já está cadastrada" : "Possível conta duplicada"}
            </p>
            <ul className="mt-2 space-y-1">
              {dupes.slice(0, 3).map((d) => (
                <li key={d.bill.id} className="text-slate-700">
                  <span className="font-medium">{d.bill.description}</span> — {d.bill.supplier}, {formatBRL(d.bill.amount)}, venc. {formatDate(d.bill.dueDate)} <span className="text-muted">({d.reason})</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-slate-700">
              {strong ? "Para evitar pagamento em dobro, não é possível cadastrar a mesma linha digitável duas vezes." : "Se for uma cobrança diferente, você pode salvar mesmo assim."}
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Descrição" htmlFor="b-desc" required error={errors.description} className="sm:col-span-2">
            <Input id="b-desc" value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Ex.: Energia elétrica de outubro" invalid={!!errors.description} maxLength={140} />
          </Field>
          <Field label="Empresa ou fornecedor" htmlFor="b-sup" required error={errors.supplier} extra={fromPdf("supplier")}>
            <Input id="b-sup" value={f.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="Nome do beneficiário" invalid={!!errors.supplier} maxLength={120} list="b-suppliers" />
            <datalist id="b-suppliers">
              {Array.from(new Set(data.bills.map((b) => b.supplier))).slice(0, 50).map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="CNPJ do beneficiário" htmlFor="b-cnpj" error={errors.supplierCnpj} hint="Opcional" extra={fromPdf("supplierCnpj")}>
            <Input id="b-cnpj" value={f.supplierCnpj} onChange={(e) => set("supplierCnpj", e.target.value)} onBlur={() => f.supplierCnpj && set("supplierCnpj", formatCNPJ(f.supplierCnpj))} placeholder="00.000.000/0000-00" inputMode="numeric" invalid={!!errors.supplierCnpj} />
          </Field>
          <Field label="Valor (R$)" htmlFor="b-amount" required error={errors.amount} extra={fromPdf("amount")}>
            <Input id="b-amount" value={f.amount} onChange={(e) => set("amount", e.target.value)} onBlur={() => { const v = parseBRL(f.amount); if (v !== undefined) set("amount", amountToInput(v)); }} placeholder="0,00" inputMode="decimal" className="tabular" invalid={!!errors.amount} />
          </Field>
          <Field label="Vencimento" htmlFor="b-due" required error={errors.dueDate} extra={fromPdf("dueDate")}>
            <Input id="b-due" type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} invalid={!!errors.dueDate} />
          </Field>
          <Field label="Categoria" htmlFor="b-cat" required error={errors.category}>
            <Select id="b-cat" value={f.category} onChange={(e) => set("category", e.target.value)} invalid={!!errors.category}>
              <option value="">Selecione…</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Nº do documento" htmlFor="b-doc" extra={fromPdf("documentNumber")}>
            <Input id="b-doc" value={f.documentNumber} onChange={(e) => set("documentNumber", e.target.value)} placeholder="Ex.: NF 1234" maxLength={40} />
          </Field>

          <Field
            label="Linha digitável"
            htmlFor="b-linha"
            className="sm:col-span-2"
            error={errors.digitableLine}
            extra={fromPdf("digitableLine")}
            hint="Opcional. A Luma confere os dígitos verificadores — isso detecta erros de digitação, mas não garante que o boleto seja legítimo."
          >
            <Input id="b-linha" value={f.digitableLine} onChange={(e) => set("digitableLine", e.target.value)} onBlur={() => { const d = onlyDigits(f.digitableLine); if (d.length === 47 || d.length === 48) set("digitableLine", formatLinha(d)); }} placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000" inputMode="numeric" className="font-mono text-[13px] tracking-tight" invalid={!!errors.digitableLine} />
            {linha && !isParseError(linha) && (
              <div className={cx("flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-[13px]", linha.valid ? "bg-paid-soft text-paid" : "bg-overdue-soft text-overdue")}>
                {linha.valid ? <LuCircleCheck className="size-4" /> : <LuCircleAlert className="size-4" />}
                <span className="font-semibold">
                  {linha.valid ? "Dígitos verificadores conferem" : `DV não confere: ${linha.checks.filter((c) => !c.valid).map((c) => c.label).join(", ")}`}
                </span>
                <span className="text-slate-600">
                  {linha.kind === "bancario" ? "Boleto bancário" : "Arrecadação / concessionária"}
                  {linha.amount !== undefined && ` · ${formatBRL(linha.amount)}`}
                  {linha.dueDate && ` · venc. ${formatDate(linha.dueDate)}`}
                </span>
                {linha.valid && (linha.amount !== undefined || linha.dueDate) && (
                  <button type="button" onClick={applyFromLinha} className="ml-auto rounded-md bg-white px-2 py-1 text-xs font-semibold text-navy-700 hover:bg-sky-50">
                    Usar valor e vencimento da linha
                  </button>
                )}
              </div>
            )}
          </Field>

          <Field
            label="Chave Pix"
            htmlFor="b-pixkey"
            className="sm:col-span-2"
            error={errors.pixKey}
            extra={fromPdf("pixKey")}
            hint={keyInfo ? `${PIX_KEY_TYPE_LABEL[keyInfo.type]} reconhecido` : "Opcional. CPF, CNPJ, e-mail, celular ou chave aleatória."}
          >
            <Input id="b-pixkey" value={f.pixKey} onChange={(e) => set("pixKey", e.target.value)} onBlur={() => keyInfo && set("pixKey", formatPixKey(keyInfo.key, keyInfo.type))} placeholder="Ex.: financeiro@fornecedor.com.br" maxLength={120} invalid={!!errors.pixKey} />
          </Field>
          <Field label="Pix Copia e Cola" htmlFor="b-pixcode" error={errors.pixCopiaECola} extra={fromPdf("pixCopiaECola")} className="sm:col-span-2">
            <Textarea
              id="b-pixcode"
              value={f.pixCopiaECola}
              onChange={(e) => set("pixCopiaECola", e.target.value)}
              placeholder="00020126…"
              className="min-h-16 break-all font-mono text-[12px]"
              maxLength={600}
            />
            {pix && (
              <div className={cx("flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-3 py-2 text-[13px]", pix.crcValid ? "bg-paid-soft text-paid" : "bg-overdue-soft text-overdue")}>
                {pix.crcValid ? <LuCircleCheck className="size-4" /> : <LuCircleAlert className="size-4" />}
                <span className="font-semibold">{pix.crcValid ? "Código Pix íntegro (CRC confere)" : "CRC não confere — o código pode estar incompleto"}</span>
                <span className="text-slate-600">
                  {pix.merchantName && `Recebedor: ${pix.merchantName}`}
                  {pix.amount !== undefined && ` · ${formatBRL(pix.amount)}`}
                  {pix.dynamic && " · QR dinâmico"}
                </span>
                {pix.crcValid && pix.key && !f.pixKey.trim() && (
                  <button type="button" onClick={() => set("pixKey", formatPixKey(pix.key!, pix.keyType))} className="ml-auto rounded-md bg-white px-2 py-1 text-xs font-semibold text-navy-700 hover:bg-sky-50">
                    Usar chave do código
                  </button>
                )}
              </div>
            )}
            {pix?.merchantName && f.supplier.trim() && !namesLookRelated(f.supplier, pix.merchantName) && (
              <p className="flex items-start gap-1.5 text-xs font-medium text-soon">
                <LuTriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                O recebedor do Pix ({pix.merchantName}) é diferente do fornecedor informado. Confirme antes de pagar.
              </p>
            )}
          </Field>

          <Field label="Banco emissor" htmlFor="b-bank" extra={fromPdf("bank")}>
            <Input id="b-bank" value={f.bank} onChange={(e) => set("bank", e.target.value)} placeholder="Ex.: 341 – Itaú Unibanco" maxLength={60} />
          </Field>
          <Field label="Pagador" htmlFor="b-payer" extra={fromPdf("payer")}>
            <Input id="b-payer" value={f.payer} onChange={(e) => set("payer", e.target.value)} placeholder="Quem paga o boleto" maxLength={120} />
          </Field>
          <Field label="Observações" htmlFor="b-notes" className="sm:col-span-2">
            <Textarea id="b-notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} maxLength={1000} placeholder="Informações internas, centro de custo, aprovação…" />
          </Field>
        </div>

        <div className="grid gap-4 rounded-xl border border-line bg-paper/60 p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2.5 text-sm font-semibold">
              <input type="checkbox" className="size-4 accent-[#1f7a55]" checked={f.paid} onChange={(e) => set("paid", e.target.checked)} />
              Esta conta já foi paga
            </label>
            {f.paid && (
              <Field label="Data do pagamento" htmlFor="b-paidat" error={errors.paidAt}>
                <Input id="b-paidat" type="date" value={f.paidAt} onChange={(e) => set("paidAt", e.target.value)} />
              </Field>
            )}
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <span className="font-semibold">Anexo PDF</span>
            {newFile ? (
              <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2">
                <LuFileText className="size-4 text-navy-600" />
                <span className="min-w-0 flex-1 truncate">{newFile.name}</span>
                <span className="text-xs text-muted">{formatFileSize(newFile.size)}</span>
              </div>
            ) : attachment ? (
              <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2">
                <LuPaperclip className="size-4 text-navy-600" />
                <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                <button type="button" className="text-muted hover:text-overdue" aria-label="Remover anexo" onClick={() => setAttachment(undefined)}>
                  <LuTrash2 className="size-4" />
                </button>
              </div>
            ) : null}
            {newFile && pendingFile === newFile && (
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" className="size-4 accent-[#0e1f3d]" checked={keepPdf} onChange={(e) => setKeepPdf(e.target.checked)} />
                Guardar este PDF junto com a conta
              </label>
            )}
            {!newFile && (
              <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-sky-300 bg-white px-3 py-2 text-[13px] font-semibold text-navy-700 hover:bg-sky-50">
                <LuPaperclip className="size-4" />
                {attachment ? "Substituir PDF" : "Anexar PDF"}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > MAX_ATTACHMENT_BYTES) {
                      toast("error", "O anexo deve ter no máximo 10 MB.");
                      return;
                    }
                    setNewFile(file);
                    setKeepPdf(true);
                  }}
                />
              </label>
            )}
            <p className="text-xs text-muted">O arquivo fica guardado somente neste navegador (até 10 MB).</p>
          </div>
        </div>
      </form>
    </Modal>
  );
}
