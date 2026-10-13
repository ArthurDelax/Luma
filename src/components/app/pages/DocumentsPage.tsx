"use client";

import { useMemo, useState, type FormEvent } from "react";
import { LuFileText, LuPaperclip, LuPencil, LuPlus, LuSearch, LuTrash2, LuFilePenLine } from "react-icons/lu";
import { deleteAttachment, MAX_ATTACHMENT_BYTES, openAttachment, saveAttachment } from "@/lib/attachments";
import { formatDate, isValidISO, relativeDays } from "@/lib/dates";
import { docSituation, DOCUMENT_TYPES, type DocSituation } from "@/lib/domain";
import { formatFileSize, normalizeText } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { BusinessDocument, DocKind, DocStatus } from "@/lib/types";
import { Badge, Button, cx, EmptyState, Field, IconButton, Input, Modal, PageHeader, Segmented, Select, Textarea, useConfirm, useToast, type Tone } from "../../ui";

const STATUS_LABEL: Record<DocStatus, string> = { ativo: "Ativo", em_renovacao: "Em renovação", encerrado: "Encerrado" };

const SITUATION: Record<DocSituation, { tone: Tone; label: (d: number) => string }> = {
  vencido: { tone: "overdue", label: (d) => `Vencido ${relativeDays(d)}` },
  vence_hoje: { tone: "overdue", label: () => "Vence hoje" },
  proximo: { tone: "soon", label: (d) => `Vence ${relativeDays(d)}` },
  vigente: { tone: "paid", label: () => "Vigente" },
  encerrado: { tone: "neutral", label: () => "Encerrado" },
};

function DocForm({ initial, onClose }: { initial: Partial<BusinessDocument>; onClose: () => void }) {
  const { addDocument, updateDocument, requireWrite } = useStore();
  const toast = useToast();
  const [f, setF] = useState({
    name: initial.name ?? "",
    kind: (initial.kind ?? "contrato") as DocKind,
    type: initial.type ?? "",
    party: initial.party ?? "",
    startDate: initial.startDate ?? "",
    endDate: initial.endDate ?? "",
    notes: initial.notes ?? "",
    status: (initial.status ?? "ativo") as DocStatus,
  });
  const [file, setFile] = useState<File | undefined>();
  const [attachment, setAttachment] = useState(initial.attachment);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const set = (k: keyof typeof f, v: string) => {
    setF((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!requireWrite()) return;
    const err: Record<string, string> = {};
    if (!f.name.trim()) err.name = "Informe o nome.";
    if (!f.type) err.type = "Escolha o tipo.";
    if (!f.party.trim()) err.party = "Informe a empresa ou o responsável.";
    if (!isValidISO(f.endDate)) err.endDate = "Informe a data de vencimento.";
    if (f.startDate && !isValidISO(f.startDate)) err.startDate = "Data inválida.";
    if (f.startDate && isValidISO(f.endDate) && f.endDate < f.startDate) err.endDate = "O vencimento deve ser depois do início.";
    setErrors(err);
    if (Object.keys(err).length) return;
    let att = attachment;
    if (initial.attachment && !attachment) await deleteAttachment(initial.attachment.id);
    if (file) {
      try {
        if (attachment) await deleteAttachment(attachment.id);
        att = await saveAttachment(file, file.name);
      } catch {
        toast("error", "Não foi possível guardar o anexo neste navegador.");
      }
    }
    const payload = { ...f, name: f.name.trim(), party: f.party.trim(), startDate: f.startDate || undefined, notes: f.notes.trim() || undefined, attachment: att };
    if (initial.id) {
      updateDocument(initial.id, payload);
      toast("success", "Registro atualizado.");
    } else {
      addDocument(payload);
      toast("success", f.kind === "contrato" ? "Contrato cadastrado." : "Documento cadastrado.");
    }
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial.id ? "Editar registro" : "Novo contrato ou documento"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="doc-form">
            {initial.id ? "Salvar alterações" : "Cadastrar"}
          </Button>
        </>
      }
    >
      <form id="doc-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Segmented
            label="Tipo de registro"
            value={f.kind}
            onChange={(v) => {
              setF((s) => ({ ...s, kind: v, type: "" }));
            }}
            options={[
              { value: "contrato", label: "Contrato" },
              { value: "documento", label: "Documento" },
            ]}
          />
        </div>
        <Field label="Nome" htmlFor="d-name" required error={errors.name} className="sm:col-span-2">
          <Input id="d-name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder={f.kind === "contrato" ? "Ex.: Contrato de suporte de TI" : "Ex.: Alvará de funcionamento"} invalid={!!errors.name} />
        </Field>
        <Field label="Tipo" htmlFor="d-type" required error={errors.type}>
          <Select id="d-type" value={f.type} onChange={(e) => set("type", e.target.value)} invalid={!!errors.type}>
            <option value="">Selecione…</option>
            {DOCUMENT_TYPES[f.kind].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Empresa ou responsável" htmlFor="d-party" required error={errors.party}>
          <Input id="d-party" value={f.party} onChange={(e) => set("party", e.target.value)} invalid={!!errors.party} />
        </Field>
        <Field label="Data de início" htmlFor="d-start" error={errors.startDate} hint="Opcional">
          <Input id="d-start" type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </Field>
        <Field label="Data de vencimento" htmlFor="d-end" required error={errors.endDate}>
          <Input id="d-end" type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} invalid={!!errors.endDate} />
        </Field>
        <Field label="Status" htmlFor="d-status">
          <Select id="d-status" value={f.status} onChange={(e) => set("status", e.target.value)}>
            {(Object.keys(STATUS_LABEL) as DocStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Anexo (PDF)" htmlFor="d-file" hint="Guardado somente neste navegador, até 10 MB.">
          {attachment && !file ? (
            <div className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
              <LuPaperclip className="size-4 text-navy-600" />
              <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
              <button type="button" aria-label="Remover anexo" className="text-muted hover:text-overdue" onClick={() => setAttachment(undefined)}>
                <LuTrash2 className="size-4" />
              </button>
            </div>
          ) : (
            <input
              id="d-file"
              type="file"
              accept="application/pdf,.pdf"
              className="field file:mr-3 file:rounded-md file:border-0 file:bg-sky-100 file:px-2.5 file:py-1 file:text-[13px] file:font-semibold file:text-navy-700"
              onChange={(e) => {
                const fl = e.target.files?.[0];
                if (fl && fl.size > MAX_ATTACHMENT_BYTES) {
                  toast("error", "O anexo deve ter no máximo 10 MB.");
                  e.target.value = "";
                  return;
                }
                setFile(fl);
              }}
            />
          )}
        </Field>
        <Field label="Observações" htmlFor="d-notes" className="sm:col-span-2">
          <Textarea id="d-notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

export function DocumentsPage() {
  const { data, today, deleteDocument, requireWrite } = useStore();
  const openEditor = (d: Partial<BusinessDocument>) => {
    if (requireWrite()) setEditing(d);
  };
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState<Partial<BusinessDocument> | null>(null);
  const [kind, setKind] = useState<"todos" | DocKind>("todos");
  const [situation, setSituation] = useState<"todas" | "atencao" | "vigente" | "encerrado">("todas");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const nq = normalizeText(q);
    return data.documents
      .map((d) => ({ d, ...docSituation(d, today) }))
      .filter(({ d, situation: s }) => {
        if (kind !== "todos" && d.kind !== kind) return false;
        if (situation === "atencao" && !["vencido", "vence_hoje", "proximo"].includes(s)) return false;
        if (situation === "vigente" && s !== "vigente") return false;
        if (situation === "encerrado" && s !== "encerrado") return false;
        if (nq && !normalizeText(`${d.name} ${d.party} ${d.type} ${d.notes ?? ""}`).includes(nq)) return false;
        return true;
      })
      .sort((a, b) => Number(a.situation === "encerrado") - Number(b.situation === "encerrado") || a.d.endDate.localeCompare(b.d.endDate));
  }, [data.documents, today, kind, situation, q]);

  const attention = data.documents.filter((d) => ["vencido", "vence_hoje", "proximo"].includes(docSituation(d, today).situation));
  const expired = attention.filter((d) => docSituation(d, today).situation === "vencido");

  const remove = async (d: BusinessDocument) => {
    if (!requireWrite()) return;
    const ok = await confirm({ title: "Excluir registro?", message: <><strong>{d.name}</strong> será excluído definitivamente{d.attachment ? ", junto com o anexo" : ""}.</>, confirmLabel: "Excluir", danger: true });
    if (ok) {
      deleteDocument(d.id);
      toast("success", "Registro excluído.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Contratos e documentos"
        description="Controle a validade de contratos, certificados, licenças, alvarás e seguros."
        actions={
          <Button icon={<LuPlus className="size-4" />} onClick={() => openEditor({})}>
            Novo registro
          </Button>
        }
      />

      {attention.length > 0 && (
        <div className="mb-5 flex flex-col gap-1 rounded-xl border border-soon/25 bg-soon-soft/70 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            <strong>{attention.length}</strong> {attention.length === 1 ? "registro precisa" : "registros precisam"} de atenção
            {expired.length > 0 && (
              <>
                {" "}— <strong className="text-overdue">{expired.length} {expired.length === 1 ? "vencido" : "vencidos"}</strong>
              </>
            )}
            .
          </p>
          <button className="self-start text-[13px] font-semibold text-navy-700 hover:underline sm:self-auto" onClick={() => setSituation("atencao")}>
            Mostrar somente esses
          </button>
        </div>
      )}

      <div className="card mb-4 flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <Segmented label="Tipo" value={kind} onChange={setKind} options={[{ value: "todos", label: "Todos" }, { value: "contrato", label: "Contratos" }, { value: "documento", label: "Documentos" }]} />
          <Select value={situation} onChange={(e) => setSituation(e.target.value as typeof situation)} aria-label="Situação" className="w-auto">
            <option value="todas">Todas as situações</option>
            <option value="atencao">Vencidos ou a vencer (30 dias)</option>
            <option value="vigente">Vigentes</option>
            <option value="encerrado">Encerrados</option>
          </Select>
        </div>
        <div className="relative lg:w-72">
          <LuSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="pl-9" aria-label="Buscar contratos e documentos" />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState icon={<LuFilePenLine className="size-6" />} title={data.documents.length ? "Nenhum registro encontrado" : "Nenhum contrato ou documento"} action={!data.documents.length && <Button onClick={() => openEditor({})}>Cadastrar registro</Button>}>
            {data.documents.length ? "Ajuste os filtros para ver mais resultados." : "Cadastre contratos e documentos para receber alertas antes do vencimento."}
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ d, situation: s, days }) => {
            const conf = SITUATION[s];
            const start = d.startDate ? new Date(d.startDate).getTime() : undefined;
            const end = new Date(d.endDate).getTime();
            const now = new Date(today).getTime();
            const progress = start && end > start ? Math.min(1, Math.max(0, (now - start) / (end - start))) : undefined;
            return (
              <article key={d.id} className={cx("card flex flex-col p-4", s === "encerrado" && "opacity-70")}>
                <div className="flex items-start gap-3">
                  <span className={cx("grid size-9 shrink-0 place-items-center rounded-lg", d.kind === "contrato" ? "bg-contract-soft text-contract" : "bg-doc-soft text-doc")}>
                    {d.kind === "contrato" ? <LuFilePenLine className="size-[18px]" /> : <LuFileText className="size-[18px]" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold leading-snug">{d.name}</h3>
                    <p className="truncate text-xs text-muted">
                      {d.type} — {d.party}
                    </p>
                  </div>
                  <Badge tone={conf.tone} dot>
                    {conf.label(days)}
                  </Badge>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-muted">
                    <span>{d.startDate ? formatDate(d.startDate) : "Início não informado"}</span>
                    <span className="font-semibold text-ink">Vence {formatDate(d.endDate)}</span>
                  </div>
                  {progress !== undefined && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sky-100">
                      <div className={cx("h-full rounded-full", s === "vencido" || s === "vence_hoje" ? "bg-overdue" : s === "proximo" ? "bg-soon" : "bg-navy-600")} style={{ width: `${progress * 100}%` }} />
                    </div>
                  )}
                </div>
                {d.notes && <p className="mt-3 line-clamp-2 text-xs text-slate-600">{d.notes}</p>}
                <div className="mt-auto flex items-center gap-1 pt-3">
                  <span className="mr-auto text-xs text-muted">{STATUS_LABEL[d.status]}</span>
                  {d.attachment && (
                    <IconButton
                      label={`Abrir anexo (${formatFileSize(d.attachment.size)})`}
                      onClick={async () => {
                        if (!(await openAttachment(d.attachment!))) toast("error", "O anexo não está mais disponível neste navegador.");
                      }}
                    >
                      <LuPaperclip className="size-4" />
                    </IconButton>
                  )}
                  <IconButton label="Editar" onClick={() => openEditor(d)}>
                    <LuPencil className="size-4" />
                  </IconButton>
                  <IconButton label="Excluir" onClick={() => remove(d)} className="hover:!bg-overdue-soft hover:!text-overdue">
                    <LuTrash2 className="size-4" />
                  </IconButton>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing && <DocForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
