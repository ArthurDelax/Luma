"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LuArrowLeft, LuChevronRight, LuHeadset, LuLifeBuoy, LuLogIn, LuMessageCircle, LuPlus } from "react-icons/lu";
import { supportWhatsappLink, whatsappDisplay } from "@/lib/contact";
import { href } from "@/lib/paths";
import { STATUS_TEXT, supportApi, timeAgo, type Ticket } from "@/lib/support";
import { usePolling } from "@/lib/usePolling";
import { useWorkspace } from "@/lib/workspace";
import { Button, cx, Field, Input, Modal, Textarea } from "../ui";
import { SupportThread } from "./SupportThread";

const TOPICS = ["Importação de boleto", "Contas e vencimentos", "Acesso e senha", "Usuários e permissões", "Assinatura e pagamento", "Outro assunto"];

type View = { name: "home" } | { name: "new" } | { name: "thread"; ticket: Ticket };

/** Quantos chamados têm resposta nova (só na área do cliente). */
export function useSupportUnread(): number {
  const ws = useWorkspace();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (ws.mode !== "cloud" || !ws.orgId) return;
    const orgId = ws.orgId;
    const check = () => supportApi.list(orgId).then((l) => setN(l.filter((t) => t.unread).length)).catch(() => {});
    window.addEventListener("luma:support-changed", check);
    return () => window.removeEventListener("luma:support-changed", check);
  }, [ws.mode, ws.orgId]);
  // aviso de resposta nova no ícone de ajuda, ao vivo
  usePolling(
    () => {
      const orgId = ws.orgId;
      if (!orgId) return;
      return supportApi.list(orgId).then((l) => setN(l.filter((t) => t.unread).length)).catch(() => {});
    },
    15_000,
    ws.mode === "cloud" && !!ws.orgId,
  );
  return n;
}

export function HelpCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ws = useWorkspace();
  const cloud = ws.mode === "cloud" && !!ws.orgId;
  const [view, setView] = useState<View>({ name: "home" });
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const wa = supportWhatsappLink(ws.orgName);

  const reload = useCallback(async () => {
    if (!cloud || !ws.orgId) return;
    try {
      setTickets(await supportApi.list(ws.orgId));
    } catch {
      setTickets((t) => t ?? []); // falha passageira não apaga a lista
    }
  }, [cloud, ws.orgId]);

  useEffect(() => {
    if (open) setView({ name: "home" });
  }, [open]);

  // lista de chamados ao vivo enquanto a central está aberta
  usePolling(reload, 5_000, open && cloud && view.name === "home");

  const changed = () => {
    void reload();
    window.dispatchEvent(new Event("luma:support-changed"));
  };

  const title = view.name === "thread" ? view.ticket.subject : view.name === "new" ? "Falar com uma atendente" : "Central de ajuda";

  return (
    <Modal open={open} onClose={onClose} size="lg" title={title} description={view.name === "home" ? "Estamos aqui para ajudar. Escolha como prefere falar com a gente." : undefined}>
      {view.name !== "home" && (
        <button type="button" onClick={() => setView({ name: "home" })} className="-mt-1 mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <LuArrowLeft className="size-4" /> Voltar
        </button>
      )}

      {view.name === "home" && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {cloud ? (
              <button type="button" onClick={() => setView({ name: "new" })} className="group flex flex-col items-start rounded-3xl bg-ink p-5 text-left text-paper transition-transform hover:-translate-y-0.5">
                <span className="grid size-11 place-items-center rounded-2xl bg-white/10">
                  <LuHeadset className="size-5" />
                </span>
                <span className="mt-4 font-display text-lg font-semibold">Falar com uma atendente</span>
                <span className="mt-1 text-sm text-paper/65">Abra um chamado aqui mesmo. A resposta aparece nesta tela.</span>
              </button>
            ) : (
              <a href={href("/empresa/")} className="flex flex-col items-start rounded-3xl bg-ink p-5 text-paper transition-transform hover:-translate-y-0.5">
                <span className="grid size-11 place-items-center rounded-2xl bg-white/10">
                  <LuLogIn className="size-5" />
                </span>
                <span className="mt-4 font-display text-lg font-semibold">Já é cliente?</span>
                <span className="mt-1 text-sm text-paper/65">Entre na sua conta para abrir um chamado com a nossa equipe.</span>
              </a>
            )}
            {wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="flex flex-col items-start rounded-3xl border border-line bg-white p-5 transition-transform hover:-translate-y-0.5">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#25d366]/15 text-[#128c4a]">
                  <LuMessageCircle className="size-5" />
                </span>
                <span className="mt-4 font-display text-lg font-semibold">Chamar no WhatsApp</span>
                <span className="mt-1 text-sm text-muted">Fale direto com o suporte: {whatsappDisplay()}</span>
              </a>
            ) : (
              <div className="rounded-3xl border border-dashed border-line p-5 text-sm text-muted">WhatsApp do suporte indisponível no momento.</div>
            )}
          </div>

          {cloud && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Seus chamados</h3>
                <button type="button" onClick={() => setView({ name: "new" })} className="inline-flex items-center gap-1 text-sm font-semibold text-ink hover:underline">
                  <LuPlus className="size-4" /> Novo
                </button>
              </div>
              {tickets === null ? (
                <p className="py-4 text-sm text-muted">Carregando…</p>
              ) : tickets.length === 0 ? (
                <p className="rounded-2xl bg-paper px-4 py-5 text-center text-sm text-muted">Nenhum chamado ainda.</p>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
                  {tickets.map((t) => (
                    <li key={t.id}>
                      <button type="button" onClick={() => setView({ name: "thread", ticket: t })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper/60">
                        <span className={cx("size-2.5 shrink-0 rounded-full", t.unread ? "bg-overdue" : "bg-transparent")} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{t.subject}</span>
                          <span className="block truncate text-xs text-muted">{t.last_body ?? ""}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className={cx("block text-[11px] font-semibold", t.status === "respondido" ? "text-paid" : t.status === "fechado" ? "text-muted" : "text-soon")}>
                            {t.unread ? "Nova resposta" : STATUS_TEXT[t.status]}
                          </span>
                          <span className="block text-[11px] text-muted">{timeAgo(t.last_message_at)}</span>
                        </span>
                        <LuChevronRight className="size-4 shrink-0 text-muted" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <p className="flex items-center gap-2 text-xs text-muted">
            <LuLifeBuoy className="size-4" /> Respondemos assim que possível. A resposta aparece aqui e o ícone de ajuda avisa quando chegar.
          </p>
        </div>
      )}

      {view.name === "new" && ws.orgId && (
        <NewTicket
          orgId={ws.orgId}
          onCreated={(t) => {
            changed();
            setView({ name: "thread", ticket: t });
          }}
        />
      )}

      {view.name === "thread" && (
        <div className="flex h-[min(60vh,560px)] flex-col">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted">
            <span>Chamado aberto em {new Date(view.ticket.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            {view.ticket.status !== "fechado" && (
              <button
                type="button"
                className="font-semibold text-ink hover:underline"
                onClick={async () => {
                  await supportApi.setStatus(view.ticket.id, "fechado").catch(() => {});
                  changed();
                  setView({ name: "thread", ticket: { ...view.ticket, status: "fechado" } });
                }}
              >
                Encerrar chamado
              </button>
            )}
          </div>
          <SupportThread key={view.ticket.id} ticketId={view.ticket.id} viewer="cliente" load={supportApi.thread} send={supportApi.send} closed={view.ticket.status === "fechado"} onChanged={changed} />
        </div>
      )}
    </Modal>
  );
}

function NewTicket({ orgId, onCreated }: { orgId: string; onCreated: (t: Ticket) => void }) {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return setError("Conte pra gente como podemos ajudar.");
    setBusy(true);
    setError("");
    try {
      const id = await supportApi.open(orgId, topic, body);
      const now = new Date().toISOString();
      onCreated({ id, subject: topic, status: "aberto", unread: false, created_at: now, last_message_at: now, last_body: body });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir o chamado.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Assunto" htmlFor="sup-topic">
        <div className="flex flex-wrap gap-2" id="sup-topic" role="radiogroup" aria-label="Assunto">
          {TOPICS.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={topic === t} onClick={() => setTopic(t)} className={cx("rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors", topic === t ? "border-ink bg-ink text-paper" : "border-line bg-white hover:border-ink/30")}>
              {t}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Como podemos ajudar?" htmlFor="sup-body">
        <Textarea id="sup-body" rows={5} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Descreva o que aconteceu. Se for sobre um boleto, diga o banco ou o tipo de guia." data-autofocus />
      </Field>
      {error && (
        <p role="alert" className="rounded-xl bg-overdue-soft px-3 py-2 text-sm font-medium text-overdue">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Enviando…" : "Enviar para o suporte"}
      </Button>
      <p className="text-center text-xs text-muted">Nunca envie senhas por aqui. A equipe da Luma nunca pede sua senha.</p>
    </form>
  );
}

/** Botão "Ajuda" com o contador de respostas novas. */
export function HelpButton({ className, variant = "icon" }: { className?: string; variant?: "icon" | "pill" }) {
  const [open, setOpen] = useState(false);
  const unread = useSupportUnread();
  return (
    <>
      {variant === "pill" ? (
        <button type="button" onClick={() => setOpen(true)} className={cx("inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-paper shadow-[0_10px_30px_-10px_rgba(0,0,0,.6)]", className)}>
          <LuLifeBuoy className="size-4" /> Ajuda
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} aria-label={unread ? `Ajuda e suporte (${unread} respostas novas)` : "Ajuda e suporte"} title="Ajuda e suporte" className={cx("relative inline-grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-sky-100 hover:text-ink", className)}>
          <LuLifeBuoy className="size-5" />
          {unread > 0 && <span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-overdue px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-paper">{unread}</span>}
        </button>
      )}
      <HelpCenter open={open} onClose={() => setOpen(false)} />
    </>
  );
}
