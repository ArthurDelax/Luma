/**
 * Suporte ao cliente: chamados e mensagens (Supabase, funções do 0004_suporte.sql).
 * O papel de quem escreve (cliente ou suporte) é decidido pelo banco.
 */

import { authed } from "./supabase.ts";

export type TicketStatus = "aberto" | "respondido" | "fechado";

export interface Ticket {
  id: string;
  subject: string;
  status: TicketStatus;
  unread: boolean;
  created_at: string;
  last_message_at: string;
  last_body: string | null;
}

export interface AdminTicket extends Ticket {
  org_id: string;
  org_name: string;
  requester_email: string | null;
  last_role: "cliente" | "suporte" | null;
}

export interface Message {
  id: number;
  author_role: "cliente" | "suporte";
  author_email: string | null;
  body: string;
  created_at: string;
}

const call = <T,>(fn: string, args: Record<string, unknown>) => authed<T>(`/rest/v1/rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });

export const supportApi = {
  list: (orgId: string) => call<Ticket[]>("support_list", { p_org: orgId }),
  open: (orgId: string, subject: string, body: string) => call<string>("support_open", { p_org: orgId, p_subject: subject, p_body: body }),
  thread: (ticketId: string) => call<Message[]>("support_thread", { p_ticket: ticketId }),
  send: (ticketId: string, body: string) => call<void>("support_send", { p_ticket: ticketId, p_body: body }),
  setStatus: (ticketId: string, status: TicketStatus) => call<void>("support_set_status", { p_ticket: ticketId, p_status: status }),
  adminList: (status?: TicketStatus) => call<AdminTicket[]>("admin_support_list", { p_status: status ?? null }),
};

export const STATUS_TEXT: Record<TicketStatus, string> = {
  aberto: "Aguardando atendimento",
  respondido: "Respondido",
  fechado: "Encerrado",
};

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
