"use client";

import { useEffect, useMemo, useState } from "react";
import { LuDownload, LuFileText } from "react-icons/lu";
import { planAccountantPackage } from "@/lib/accountant";
import { getAttachment } from "@/lib/attachments";
import { addMonthsClamped, monthKey, monthLabel, startOfMonth } from "@/lib/dates";
import { formatBRL } from "@/lib/format";
import { useStore } from "@/lib/store";
import { useWorkspace } from "@/lib/workspace";
import { buildZip, type ZipEntry } from "@/lib/zip";
import { ModalCloseButton, Button, Field, Modal, Select, useToast } from "../../ui";

/** Botão + janela "Pacote do contador": fechamento do mês num único .zip. */
export function AccountantPackageButton() {
  const [open, setOpen] = useState(false);
  // atalho do painel: #/relatorios?pacote=1 abre direto
  useEffect(() => {
    if (/[?&]pacote=1/.test(window.location.hash)) setOpen(true);
  }, []);
  return (
    <>
      <Button variant="secondary" icon={<LuFileText className="size-4" />} onClick={() => setOpen(true)}>
        Pacote do contador
      </Button>
      <AccountantPackageModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AccountantPackageModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, today } = useStore();
  const ws = useWorkspace();
  const toast = useToast();
  // padrão: mês anterior (o fechamento que o contador costuma pedir)
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => monthKey(addMonthsClamped(startOfMonth(today), -i, 1))), [today]);
  const [month, setMonth] = useState(months[1]);
  const [busy, setBusy] = useState(false);
  const plan = useMemo(() => planAccountantPackage(data.bills, month, today, ws.orgName), [data.bills, month, today, ws.orgName]);

  const download = async () => {
    setBusy(true);
    try {
      const enc = new TextEncoder();
      const entries: ZipEntry[] = plan.files.map((f) => ({ name: f.name, data: enc.encode(f.text) }));
      let missing = 0;
      for (const a of plan.attachments) {
        try {
          const blob = await getAttachment(a.bill.attachment!.id);
          if (blob) entries.push({ name: a.path, data: new Uint8Array(await blob.arrayBuffer()) });
          else missing++;
        } catch {
          missing++;
        }
      }
      const zip = buildZip(entries);
      const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = plan.zipName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast("success", missing ? `Pacote gerado. ${missing} PDF(s) não puderam ser incluídos.` : "Pacote do contador gerado.");
      onClose();
    } catch {
      toast("error", "Não foi possível gerar o pacote.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pacote do contador"
      description="O fechamento do mês num único arquivo .zip, pronto para enviar à contabilidade."
      footer={
        <>
          <ModalCloseButton>
            Cancelar
          </ModalCloseButton>
          <Button icon={<LuDownload className="size-4" />} onClick={download} disabled={busy || (!plan.paid.length && !plan.open.length)}>
            {busy ? "Gerando…" : "Baixar pacote (.zip)"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Mês" htmlFor="acc-month">
          <Select id="acc-month" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m, false)}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-paid-soft/70 p-3.5">
            <p className="text-xs font-semibold text-paid">Pagas no mês</p>
            <p className="mt-0.5 font-display text-xl font-semibold tabular">{formatBRL(plan.totalPaid)}</p>
            <p className="text-xs text-muted">{plan.paid.length} conta(s)</p>
          </div>
          <div className="rounded-xl bg-soon-soft/70 p-3.5">
            <p className="text-xs font-semibold text-soon">Em aberto do mês</p>
            <p className="mt-0.5 font-display text-xl font-semibold tabular">{formatBRL(plan.totalOpen)}</p>
            <p className="text-xs text-muted">{plan.open.length} conta(s)</p>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-white p-3.5 text-sm">
          <p className="mb-1.5 font-semibold">O que vai no pacote</p>
          <ul className="space-y-1 text-slate-700">
            <li>• Planilha das contas pagas no mês (abre no Excel)</li>
            <li>• Resumo do total pago por categoria</li>
            <li>• Contas do mês que ficaram em aberto</li>
            <li>
              • {plan.attachments.length} boleto(s) em PDF
              {plan.paid.length > plan.attachments.length && <span className="text-muted"> — {plan.paid.length - plan.attachments.length} conta(s) paga(s) sem PDF anexado</span>}
            </li>
          </ul>
        </div>
        {!plan.paid.length && !plan.open.length && <p className="text-sm text-muted">Nenhuma conta paga ou com vencimento neste mês.</p>}
      </div>
    </Modal>
  );
}
