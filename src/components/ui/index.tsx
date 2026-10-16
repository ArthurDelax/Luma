"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { LuCircleAlert, LuCircleCheck, LuInfo, LuX } from "react-icons/lu";

/**
 * Mantém um elemento na tela enquanto a animação de saída roda.
 * Retorna se deve renderizar e o estado para o atributo data-state.
 */
export function usePresence(open: boolean, exitMs = 240): { render: boolean; state: "open" | "closed" } {
  const [render, setRender] = useState(open);
  useEffect(() => {
    if (open) {
      setRender(true);
      return;
    }
    const t = setTimeout(() => setRender(false), exitMs);
    return () => clearTimeout(t);
  }, [open, exitMs]);
  return { render: open || render, state: open ? "open" : "closed" };
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Logo                                                                 */
/* ------------------------------------------------------------------ */

/** Símbolo da Luma: balão de conversa com lua e brilho. */
export function LogoMark({ className = "size-8", tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  const c = tone === "dark" ? "#111111" : "#f2f2ee";
  return (
    <svg viewBox="8 8 336 356" className={className} aria-hidden="true" fill="none">
      <path d="M114.6 310.7L34 342L71.8 281.8A148.5 148.5 0 1 1 114.6 310.7Z" stroke={c} strokeWidth="34" strokeLinejoin="round" />
      <path d="M159.2 105.8A77 77 0 1 0 246.2 192.8A62.5 62.5 0 0 1 159.2 105.8Z" fill={c} />
      <path d="M231 81.5Q238 113 269.5 120Q238 127 231 158.5Q224 127 192.5 120Q224 113 231 81.5Z" fill={c} />
    </svg>
  );
}

export function Logo({ tone = "dark", className, size = "md" }: { tone?: "dark" | "light"; className?: string; size?: "md" | "lg" }) {
  return (
    <span className={cx("inline-flex items-center", size === "lg" ? "gap-3" : "gap-2.5", className)}>
      <LogoMark tone={tone} className={size === "lg" ? "size-10" : "size-[30px]"} />
      <span className={cx("font-display font-bold leading-none tracking-[-0.03em]", size === "lg" ? "text-[2rem]" : "text-[1.55rem]", tone === "dark" ? "text-ink" : "text-paper")}>Luma</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Botões                                                               */
/* ------------------------------------------------------------------ */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-navy-700 shadow-[0_1px_0_rgb(255_255_255/0.08)_inset,0_6px_16px_-8px_rgb(17_17_17/0.6)]",
  secondary: "bg-white text-ink border border-line hover:border-ink/30",
  ghost: "text-ink hover:bg-sky-100",
  danger: "bg-overdue text-white hover:bg-[#b23431]",
  soft: "bg-sky-100 text-ink hover:bg-sky-200",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; icon?: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 active:scale-[0.97] disabled:opacity-50",
        size === "sm" ? "h-8 px-3.5 text-[13px]" : "h-10 px-5 text-sm",
        variants[variant],
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx("inline-grid size-9 place-items-center rounded-full text-muted transition-[color,background-color,transform] duration-150 hover:bg-sky-100 hover:text-ink active:scale-90 disabled:opacity-40", className)}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Badges                                                               */
/* ------------------------------------------------------------------ */

export type Tone = "overdue" | "soon" | "paid" | "neutral" | "info" | "contract" | "doc";

const tones: Record<Tone, string> = {
  overdue: "bg-overdue-soft text-overdue",
  soon: "bg-soon-soft text-soon",
  paid: "bg-paid-soft text-paid",
  neutral: "bg-slate-100 text-slate-600",
  info: "bg-sky-100 text-ink",
  contract: "bg-contract-soft text-contract",
  doc: "bg-doc-soft text-doc",
};

export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Campos de formulário                                                 */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
  required,
  extra,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  required?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink">
          {label}
          {required && <span className="ml-0.5 text-overdue">*</span>}
        </label>
        {extra}
      </div>
      {children}
      {error ? (
        <p className="text-xs font-medium text-overdue" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...rest} aria-invalid={invalid || undefined} className={cx("field", className)} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx("field min-h-20 resize-y", className)} />;
}

export function Select({ className, children, invalid, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select {...rest} aria-invalid={invalid || undefined} className={cx("field appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-8", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235b6b84' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}>
      {children}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                                */
/* ------------------------------------------------------------------ */

/** Dentro de uma janela: fecha com a animação de saída. */
const ModalDismissContext = createContext<(() => void) | null>(null);

/** Botão "Cancelar/Fechar" que fecha a janela com animação. */
export function ModalCloseButton({ children = "Cancelar", ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & { variant?: Variant }) {
  const dismiss = useContext(ModalDismissContext);
  return (
    <Button variant="secondary" {...rest} onClick={() => dismiss?.()}>
      {children}
    </Button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // fechar pelo X, pelo fundo ou pelo Esc: anima a saída e só depois avisa quem abriu
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (open) setLeaving(false);
  }, [open]);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (open) closingRef.current = false;
  }, [open]);
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setLeaving(true);
    setTimeout(() => {
      onCloseRef.current();
      // se quem abriu não fechou (ex.: algo em andamento), a janela volta a aparecer
      setTimeout(() => {
        closingRef.current = false;
        setLeaving(false);
      }, 320);
    }, 200);
  }, []);
  const shown = open && !leaving;
  const { render, state } = usePresence(shown, 260);
  // durante a saída, continua mostrando o último conteúdo (quem abriu pode já ter limpado os dados)
  const last = useRef({ title, description, children, footer });
  if (open) last.current = { title, description, children, footer };

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      const target = panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current?.querySelector<HTMLElement>("input,select,textarea,button:not([data-close])");
      target?.focus();
    }, 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      clearTimeout(t);
      prev?.focus?.();
    };
  }, [open, requestClose]);

  if (!render || !mounted) return null;
  const view = last.current;
  const widths = { sm: "sm:max-w-md", md: "sm:max-w-2xl", lg: "sm:max-w-4xl" };
  return createPortal(
    <ModalDismissContext.Provider value={requestClose}>
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div data-state={state} className="anim-fade absolute inset-0 bg-navy-950/45 sm:backdrop-blur-[3px]" onClick={requestClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-state={state}
        className={cx("anim-modal relative flex max-h-[92dvh] w-full flex-col rounded-t-[24px] bg-white shadow-[var(--shadow-pop)] sm:rounded-[24px]", widths[size])}
      >
        <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 pb-4 pt-2.5 sm:px-6 sm:pt-4">
          <div>
            <h2 id={titleId} className="font-display text-lg font-semibold">
              {view.title}
            </h2>
            {view.description && <div className="mt-0.5 text-sm text-muted">{view.description}</div>}
          </div>
          <IconButton label="Fechar" onClick={requestClose} data-close>
            <LuX className="size-5" />
          </IconButton>
        </div>
        <div className="overscroll-contain overflow-y-auto px-5 py-5 sm:px-6">{view.children}</div>
        {view.footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-paper/60 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:rounded-b-[24px] sm:px-6 sm:pb-3.5">{view.footer}</div>}
      </div>
    </div>
    </ModalDismissContext.Provider>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Confirmação                                                          */
/* ------------------------------------------------------------------ */

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
}

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title ?? ""}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button variant={state?.danger ? "danger" : "primary"} onClick={() => close(true)} data-autofocus>
              {state?.confirmLabel}
            </Button>
          </>
        }
      >
        <div className="text-sm leading-relaxed text-slate-600">{state?.message}</div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);

/* ------------------------------------------------------------------ */
/* Toasts                                                               */
/* ------------------------------------------------------------------ */

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; onClick: () => void };
  leaving?: boolean;
}

const ToastContext = createContext<(kind: ToastKind, message: string, action?: Toast["action"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  // some com animação: marca "saindo" e remove depois
  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 200);
  }, []);
  const push = useCallback(
    (kind: ToastKind, message: string, action?: Toast["action"]) => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-3), { id, kind, message, action }]);
      setTimeout(() => dismissToast(id), action ? 7000 : 4200);
    },
    [dismissToast],
  );
  const icons = {
    success: <LuCircleCheck className="size-5 shrink-0 text-[#6fd3a0]" />,
    error: <LuCircleAlert className="size-5 shrink-0 text-[#ff8a8a]" />,
    info: <LuInfo className="size-5 shrink-0 text-paper/70" />,
  };
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:px-6" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={cx("pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-paper shadow-[var(--shadow-pop)]", t.leaving ? "toast-out" : "animate-toast-in")}>
            {icons[t.kind]}
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                className="rounded-full px-2.5 py-1 font-semibold text-paper underline-offset-2 hover:bg-white/10"
                onClick={() => {
                  t.action?.onClick();
                  dismissToast(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ------------------------------------------------------------------ */
/* Estado vazio e cabeçalho de página                                   */
/* ------------------------------------------------------------------ */

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="dot-grid mb-4 grid size-16 place-items-center rounded-full border border-line bg-paper text-ink">
        {icon}
      </div>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="no-print flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-full bg-sky-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
            value === o.value ? "bg-ink text-paper shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
          {o.count !== undefined && <span className={cx("rounded-full px-1.5 text-[11px] tabular", value === o.value ? "bg-white/15 text-paper" : "bg-white/80 text-muted")}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
