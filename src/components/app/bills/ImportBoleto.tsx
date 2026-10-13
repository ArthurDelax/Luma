"use client";

import { useRef, useState, type DragEvent } from "react";
import { LuDownload, LuFileUp, LuLoaderCircle, LuShieldCheck } from "react-icons/lu";
import { extractBoleto, type ExtractedBoleto } from "@/lib/boleto/extract";
import { MAX_PDF_BYTES, PdfReadError, readPdf } from "@/lib/boleto/pdf";
import { href } from "@/lib/paths";
import { useStore } from "@/lib/store";
import { Button, cx, Modal } from "../../ui";

export function ImportBoleto({
  open,
  onClose,
  onExtracted,
  onManual,
}: {
  open: boolean;
  onClose: () => void;
  onExtracted: (file: File, result: ExtractedBoleto) => void;
  onManual: () => void;
}) {
  const { today } = useStore();
  const [state, setState] = useState<"idle" | "reading" | "error">("idle");
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const reset = () => {
    setState("idle");
    setError("");
  };

  async function handle(file: File | undefined) {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setState("error");
      setError("Selecione um arquivo PDF.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setState("error");
      setError("O arquivo tem mais de 15 MB. Selecione um boleto menor ou cadastre manualmente.");
      return;
    }
    setState("reading");
    try {
      const buf = await file.arrayBuffer();
      const { items, qrCodes } = await readPdf(buf);
      const result = extractBoleto(items, today, { qrCodes });
      reset();
      onExtracted(file, result);
    } catch (e) {
      setState("error");
      setError(e instanceof PdfReadError ? e.message : "Não foi possível ler este PDF. Você pode cadastrar a conta manualmente.");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    void handle(e.dataTransfer.files?.[0]);
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Importar boleto em PDF"
      description="A Luma tenta identificar os dados e você confere antes de cadastrar."
      size="md"
      footer={
        <>
          <a href={href("/exemplos/boleto-exemplo.pdf")} download className="mr-auto inline-flex h-10 items-center gap-2 rounded-[10px] px-3 text-sm font-semibold text-navy-700 hover:bg-sky-100">
            <LuDownload className="size-4" />
            Baixar boleto de exemplo
          </a>
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              onManual();
            }}
          >
            Cadastrar manualmente
          </Button>
        </>
      }
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cx(
          "relative flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          drag ? "border-sky-400 bg-sky-50" : "border-sky-200 bg-paper/70",
        )}
      >
        {state === "reading" ? (
          <>
            <LuLoaderCircle className="size-10 animate-spin text-sky-500" />
            <p className="mt-4 font-semibold">Lendo o boleto…</p>
            <p className="mt-1 text-sm text-muted">Procurando linha digitável, chave Pix e QR Code. O arquivo é processado no seu navegador.</p>
          </>
        ) : (
          <>
            <div className="grid size-14 place-items-center rounded-2xl bg-white text-navy-700 shadow-sm">
              <LuFileUp className="size-7" />
            </div>
            <p className="mt-4 font-display text-lg font-semibold">Arraste o PDF do boleto aqui</p>
            <p className="mt-1 text-sm text-muted">ou</p>
            <Button className="mt-3" onClick={() => input.current?.click()} data-autofocus>
              Selecionar arquivo
            </Button>
            <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => handle(e.target.files?.[0])} aria-label="Selecionar boleto em PDF" />
            {state === "error" && (
              <p role="alert" className="mt-4 rounded-lg bg-overdue-soft px-3 py-2 text-sm font-medium text-overdue">
                {error}
              </p>
            )}
          </>
        )}
      </div>
      <ul className="mt-5 space-y-2 text-[13px] text-slate-600">
        <li className="flex gap-2">
          <LuShieldCheck className="mt-0.5 size-4 shrink-0 text-paid" />
          O PDF é lido no seu navegador e não é enviado para nenhum servidor.
        </li>
        <li className="flex gap-2">
          <LuShieldCheck className="mt-0.5 size-4 shrink-0 text-paid" />
          Reconhece linha digitável, chave Pix e QR Code Pix (copia e cola) de boletos digitais. Em PDFs escaneados o texto não é lido, mas o QR Code Pix ainda pode ser.
        </li>
        <li className="flex gap-2">
          <LuShieldCheck className="mt-0.5 size-4 shrink-0 text-paid" />
          Dígitos verificadores corretos indicam que a linha foi lida sem erros — não comprovam que o boleto é legítimo. Confira sempre o beneficiário.
        </li>
      </ul>
    </Modal>
  );
}
