"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LuArrowLeft, LuCircleCheck, LuInbox, LuRotateCcw } from "react-icons/lu";
import { STATUS_TEXT, timeAgo, type AdminTicket, type Message, type TicketStatus } from "@/lib/support";
import { SupportThread } from "../support/SupportThread";
import { Badge, Button, cx, EmptyState, Segmented, useToast } from "../ui";

type Call = <T>(fn: string, args?: Record<string, unknown>) => Promise<T>;
type Filter = "abertos" | "respondidos" | "fechados" | "todos";

/** Chamados de suporte de todas as empresas (painel do dono da plataforma). */
export function AdminSupport({ call, onUnread }: { call: Call; onUnread?: (n: number) => void }) {
  const toast = useToast();
  const [tickets, setTickets] = useState<AdminTicket[] | null>(null);
  const [filter, setFilter] = useState<Filter>("abertos");
  const [selected, setSelected] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const list = await call<AdminTicket[]>("admin_support_list", { p_status: null });
      setTickets(list);
      onUnread?.(list.filter((t) => t.unread).length);
    } catch (e) {
      setTickets((t) => t ?? []);
      toast("error", e instanceof Error ? e.message : "Não foi possível carregar o suporte.");
    }
  }, [call, onUnread, toast]);

  useEffect(() => {
    void reload();
    const t = setInterval(() => void reload(), 30_000);
    return () => clearInterval(t);
  }, [reload]);

  const shown = useMemo(() => {
    const l = tickets ?? [];
    if (filter === "abertos") return l.filter((t) => t.status === "aberto");
    if (filter === "respondidos") return l.filter((t) => t.status === "respondido");
    if (filter === "fechados") return l.filter((t) => t.status === "fechado");
    return l;
  }, [tickets, filter]);

  const current = tickets?.find((t) => t.id === selected) ?? null;
  const count = (s: TicketStatus) => tickets?.filter((t) => t.status === s).length ?? 0;

  const load = useCallback((id: string) => call<Message[]>("support_thread", { p_ticket: id }), [call]);
  const send = useCallback((id: string, body: string) => call<void>("support_send", { p_ticket: id, p_body: body }), [call]);
  const setStatus = async (t: AdminTicket, status: TicketStatus) => {
    try {
      await call("support_set_status", { p_ticket: t.id, p_status: status });
      toast("success", status === "fechado" ? "Chamado encerrado." : "Chamado reaberto.");
      void reload();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Não foi possível alterar o chamado.");
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="grid md:grid-cols-[minmax(300px,380px)_1fr]">
        {/* lista */}
        <div className={cx("border-line md:border-r", selected && "hidden md:block")}>
          <div className="overflow-x-auto border-b border-line p-3 [&>*]:min-w-max">
            <Segmented
              label="Filtrar chamados"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "abertos", label: "Aguardando", count: count("aberto") },
                { value: "respondidos", label: "Respondidos" },
                { value: "fechados", label: "Encerrados" },
                { value: "todos", label: "Todos" },
              ]}
            />
          </div>
          {tickets === null ? (
            <p className="p-6 text-center text-sm text-muted">Carregando…</p>
          ) : shown.length === 0 ? (
            <EmptyState icon={<LuInbox className="size-6" />} title={filter === "abertos" ? "Nenhum chamado aguardando" : "Nenhum chamado aqui"}>
              Quando um cliente pedir ajuda pela Luma, o chamado aparece nesta lista.
            </EmptyState>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-line overflow-y-auto">
              {shown.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => setSelected(t.id)} className={cx("flex w-full gap-3 px-4 py-3 text-left hover:bg-paper/70", selected === t.id && "bg-paper")}>
                    <span className={cx("mt-1.5 size-2.5 shrink-0 rounded-full", t.unread ? "bg-overdue" : "bg-transparent")} aria-label={t.unread ? "Não lido" : undefined} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cx("truncate text-sm", t.unread ? "font-bold" : "font-semibold")}>{t.org_name}</span>
                        <span className="shrink-0 text-[11px] text-muted">{timeAgo(t.last_message_at)}</span>
                      </span>
                      <span className="block truncate text-[13px]">{t.subject}</span>
                      <span className="block truncate text-xs text-muted">
                        {t.last_role === "suporte" ? "Você: " : ""}
                        {t.last_body ?? ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* conversa */}
        <div className={cx("min-h-[60vh] flex-col p-4", selected ? "flex" : "hidden md:flex")}>
          {!current ? (
            <div className="grid flex-1 place-items-center text-center text-sm text-muted">Selecione um chamado para ver a conversa.</div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <button type="button" onClick={() => setSelected(null)} className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-muted md:hidden">
                    <LuArrowLeft className="size-3.5" /> Chamados
                  </button>
                  <p className="font-display text-lg font-semibold leading-tight">{current.subject}</p>
                  <p className="text-xs text-muted">
                    {current.org_name} · {current.requester_email ?? "cliente"} · aberto em {new Date(current.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={current.status === "fechado" ? "neutral" : current.status === "respondido" ? "paid" : "soon"} dot>
                    {STATUS_TEXT[current.status]}
                  </Badge>
                  {current.status === "fechado" ? (
                    <Button size="sm" variant="secondary" icon={<LuRotateCcw className="size-4" />} onClick={() => setStatus(current, "aberto")}>
                      Reabrir
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" icon={<LuCircleCheck className="size-4" />} onClick={() => setStatus(current, "fechado")}>
                      Encerrar
                    </Button>
                  )}
                </div>
              </div>
              <SupportThread key={current.id} ticketId={current.id} viewer="suporte" load={load} send={send} closed={current.status === "fechado"} onChanged={reload} pollMs={15_000} />
              <p className="mt-2 text-[11px] text-muted">O cliente vê sua resposta na central de ajuda da Luma. Nunca peça senhas.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
