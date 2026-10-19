/**
 * Cobrança de cliente pelo WhatsApp: abre a conversa com a mensagem pronta.
 * Usa o link público wa.me — sem API paga e sem enviar nada sozinho.
 */

import { formatDate } from "./dates.ts";
import { formatBRL } from "./format.ts";
import type { ISODate, Receivable } from "./types.ts";

/** Normaliza o celular para o formato do wa.me (55 + DDD + número). Retorna null se não parecer um celular/telefone do Brasil. */
export function waPhone(raw: string | undefined): string | null {
  let d = (raw ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return /^55\d{10,11}$/.test(d) ? d : null;
}

export function chargeMessage(r: Receivable, today: ISODate, company?: string, pixKey?: string): string {
  const late = !r.receivedAt && r.dueDate < today;
  const lines = [
    `Olá, ${r.customer.split(" ")[0]}! Tudo bem?`,
    late
      ? `Passando para lembrar que o pagamento de ${formatBRL(r.amount)} referente a "${r.description}" venceu em ${formatDate(r.dueDate)}.`
      : `Passando para lembrar do pagamento de ${formatBRL(r.amount)} referente a "${r.description}", com vencimento em ${formatDate(r.dueDate)}.`,
  ];
  if (pixKey) lines.push(`Se preferir, pode pagar por Pix na chave: ${pixKey}`);
  lines.push(late ? "Se já pagou, por favor desconsidere e me envie o comprovante. Obrigado!" : "Qualquer dúvida, estou à disposição. Obrigado!");
  if (company) lines.push(`— ${company}`);
  return lines.join("\n\n");
}

/** Link do WhatsApp com a cobrança pronta (com número do cliente, se houver). */
export function chargeLink(r: Receivable, today: ISODate, company?: string, pixKey?: string): string {
  const phone = waPhone(r.customerPhone);
  const text = encodeURIComponent(chargeMessage(r, today, company, pixKey));
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}
