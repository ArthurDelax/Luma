"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { LuSendHorizontal } from "react-icons/lu";
import type { Message } from "@/lib/support";
import { cx } from "../ui";

/** Conversa de um chamado (usada pelo cliente e pelo painel restrito). Atualiza sozinha. */
export function SupportThread({
  ticketId,
  viewer,
  load,
  send,
  closed,
  onChanged,
  pollMs = 10_000,
}: {
  ticketId: string;
  viewer: "cliente" | "suporte";
  load: (id: string) => Promise<Message[]>;
  send: (id: string, body: string) => Promise<void>;
  closed?: boolean;
  onChanged?: () => void;
  pollMs?: number;
}) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const lastId = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const m = await load(ticketId);
      setMessages(m);
      const last = m[m.length - 1]?.id ?? 0;
      if (last !== lastId.current) {
        lastId.current = last;
        requestAnimationFrame(() => end.current?.scrollIntoView({ block: "end" }));
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar a conversa.");
    }
  }, [load, ticketId]);

  useEffect(() => {
    lastId.current = 0;
    setMessages(null);
    void refresh();
    const t = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(t);
  }, [refresh, pollMs]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await send(ticketId, body);
      setText("");
      await refresh();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl bg-paper/70 p-3 sm:p-4" aria-live="polite">
        {messages === null && <p className="py-8 text-center text-sm text-muted">Carregando conversa…</p>}
        {messages?.map((m) => {
          const mine = m.author_role === viewer;
          return (
            <div key={m.id} className={cx("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cx("max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed shadow-sm", mine ? "rounded-br-md bg-ink text-paper" : "rounded-bl-md border border-line bg-white text-ink")}>
                <p className={cx("mb-0.5 text-[11px] font-semibold", mine ? "text-paper/60" : "text-muted")}>
                  {m.author_role === "suporte" ? (viewer === "suporte" ? "Você (suporte)" : "Equipe Luma") : viewer === "cliente" ? (mine ? "Você" : (m.author_email ?? "Cliente")) : (m.author_email ?? "Cliente")}
                  {" · "}
                  {new Date(m.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-overdue-soft px-3 py-2 text-sm font-medium text-overdue">
          {error}
        </p>
      )}
      <form onSubmit={submit} className="mt-3 flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          rows={2}
          maxLength={4000}
          placeholder={closed ? "Chamado encerrado — escreva para reabrir" : "Escreva sua mensagem… (Enter envia, Shift+Enter quebra linha)"}
          aria-label="Mensagem"
          className="min-h-[52px] flex-1 resize-none rounded-2xl border border-line bg-white px-4 py-3 text-[14px] outline-none transition-colors focus:border-ink/40"
        />
        <button type="submit" disabled={busy || !text.trim()} aria-label="Enviar mensagem" className="grid size-[52px] shrink-0 place-items-center rounded-full bg-ink text-paper transition-opacity disabled:opacity-40">
          <LuSendHorizontal className="size-5" />
        </button>
      </form>
    </div>
  );
}
