"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { LuImagePlus, LuLoaderCircle, LuTrash2, LuVideo } from "react-icons/lu";
import { amountToInput, parseBRL } from "@/lib/format";
import { Button, cx, Input, useToast } from "../../ui";
import { useEditor } from "./context";

/** Bloco de configurações com título. */
export function Panel({ title, description, children, actions, className }: { title: string; description?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={cx("card p-5 sm:p-6", className)}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Campo de valor em reais: aceita "12,90", "R$ 12,90" e "12.9"; grava número ao sair do campo. */
export function MoneyInput({ value, onChange, id, placeholder, allowEmpty, disabled }: { value: number | undefined | null; onChange: (v: number | undefined) => void; id?: string; placeholder?: string; allowEmpty?: boolean; disabled?: boolean }) {
  const [text, setText] = useState(value == null ? "" : amountToInput(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value == null ? "" : amountToInput(value));
  }, [value]);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">R$</span>
      <Input
        id={id}
        inputMode="decimal"
        className="pl-9 tabular"
        value={text}
        placeholder={placeholder ?? "0,00"}
        disabled={disabled}
        onFocus={() => (focused.current = true)}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseBRL(e.target.value);
          if (n !== undefined && n >= 0) onChange(n);
          else if (!e.target.value.trim() && allowEmpty) onChange(undefined);
        }}
        onBlur={() => {
          focused.current = false;
          const n = parseBRL(text);
          if (n === undefined || n < 0) {
            if (allowEmpty && !text.trim()) onChange(undefined);
            setText(value == null ? "" : amountToInput(value));
          } else setText(amountToInput(n));
        }}
      />
    </div>
  );
}

/** Interruptor liga/desliga com rótulo. */
export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx("flex cursor-pointer items-start gap-3", disabled && "cursor-not-allowed opacity-60")}>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-10 rounded-full bg-sky-200 transition-colors peer-checked:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200 [transition-timing-function:var(--ease-out-app)] peer-checked:translate-x-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** Foto (ou vídeo) com envio, prévia e remoção. */
export function MediaPicker({
  value,
  onChange,
  kind = "image",
  aspect = "aspect-square",
  label = "Enviar foto",
  className,
}: {
  value?: string;
  onChange: (url: string | undefined) => void;
  kind?: "image" | "video";
  aspect?: string;
  label?: string;
  className?: string;
}) {
  const { repo, readOnly } = useEditor();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      onChange(await repo.upload(f, kind));
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Não foi possível enviar o arquivo.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <button
        type="button"
        disabled={readOnly || busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!readOnly) void pick(e.dataTransfer.files[0]);
        }}
        className={cx("group relative grid w-full max-w-full place-items-center overflow-hidden rounded-2xl border border-dashed border-sky-300 bg-sky-50 text-muted transition-colors hover:border-ink/40 hover:text-ink", aspect)}
      >
        {value ? (
          kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <video src={`${value}#t=1`} muted playsInline preload="metadata" className="absolute inset-0 size-full object-cover" />
          )
        ) : (
          <span className="flex flex-col items-center gap-1.5 p-3 text-center text-xs font-semibold">
            {kind === "image" ? <LuImagePlus className="size-6" /> : <LuVideo className="size-6" />}
            {label}
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-white/70">
            <LuLoaderCircle className="size-6 animate-spin text-ink" />
          </span>
        )}
      </button>
      <input ref={input} type="file" accept={kind === "image" ? "image/jpeg,image/png,image/webp" : "video/mp4"} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {value && !readOnly && (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => input.current?.click()} disabled={busy}>
            Trocar
          </Button>
          <Button size="sm" variant="ghost" icon={<LuTrash2 className="size-3.5" />} onClick={() => onChange(undefined)} disabled={busy}>
            Remover
          </Button>
        </div>
      )}
    </div>
  );
}
