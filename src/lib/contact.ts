import { formatBRL } from "./format.ts";

/**
 * Número do WhatsApp comercial (somente dígitos, com DDI 55 e DDD).
 * Definido pela variável NEXT_PUBLIC_WHATSAPP_NUMBER no build. Enquanto não for
 * configurado, o botão de contato aparece desativado — nunca usamos um número inventado.
 */
export const WHATSAPP_NUMBER: string = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");

export function whatsappLink(users?: number, total?: number): string | null {
  if (!/^55\d{10,11}$/.test(WHATSAPP_NUMBER)) return null;
  const plan = users && total !== undefined ? ` no plano para ${users} ${users === 1 ? "usuário" : "usuários"} (${formatBRL(total).replace(/\s/g, " ")}/mês)` : "";
  const text = `Olá! Quero o cardápio digital da Luma para a minha loja${plan}. Pode me enviar o link de pagamento?`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/** Contato para regularizar a assinatura de uma empresa com acesso suspenso. */
export function whatsappPaymentLink(orgName: string): string | null {
  if (!/^55\d{10,11}$/.test(WHATSAPP_NUMBER)) return null;
  const text = `Olá! Quero regularizar o pagamento da assinatura da Luma da loja ${orgName} para liberar o cardápio.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/** Link do WhatsApp do suporte (mesmo número), com mensagem pronta. */
export function supportWhatsappLink(orgName?: string): string | null {
  if (!/^55\d{10,11}$/.test(WHATSAPP_NUMBER)) return null;
  const text = orgName ? `Olá! Sou cliente da Luma (loja ${orgName}) e preciso de ajuda.` : "Olá! Preciso de ajuda com a Luma.";
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/** Número formatado para exibição, ex.: (62) 99304-7680. */
export function whatsappDisplay(): string {
  const n = WHATSAPP_NUMBER.replace(/^55/, "");
  return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n;
}
