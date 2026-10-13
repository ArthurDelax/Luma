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
  const text = `Olá! Tenho interesse em contratar a Luma${plan}. Pode me ajudar?`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
