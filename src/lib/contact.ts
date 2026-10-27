import { formatBRL } from "./format.ts";
import { ANNUAL_PRICE, PLAN_PRICE, SETUP_PRICE, type Billing } from "./pricing.ts";

/**
 * Número do WhatsApp comercial (somente dígitos, com DDI 55 e DDD).
 * Definido pela variável NEXT_PUBLIC_WHATSAPP_NUMBER no build. Enquanto não for
 * configurado, o botão de contato aparece desativado — nunca usamos um número inventado.
 */
export const WHATSAPP_NUMBER: string = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");

/** Mensagem de contratação: diz o plano escolhido e o que está incluído. */
export function whatsappLink(billing?: Billing): string | null {
  if (!/^55\d{10,11}$/.test(WHATSAPP_NUMBER)) return null;
  const brl = (v: number) => formatBRL(v).replace(/\s/g, " ");
  const plan =
    billing === "anual"
      ? `Plano escolhido: *anual*, ${brl(ANNUAL_PRICE)} à vista (12 meses pelo preço de 10), com implantação grátis.`
      : billing === "mensal"
        ? `Plano escolhido: *mensal*, ${brl(PLAN_PRICE)}/mês + implantação de ${brl(SETUP_PRICE)} (uma vez).`
        : "";
  const text = ["Olá! Quero o cardápio digital da Luma para a minha loja.", plan, "Nome da loja:\nCidade:", "Pode me enviar o link de pagamento?"].filter(Boolean).join("\n\n");
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
  const text = orgName ? `Olá! Sou cliente da Luma (loja ${orgName}) e preciso de ajuda com:` : "Olá! Preciso de ajuda com a Luma:";
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/** Número formatado para exibição, ex.: (62) 99304-7680. */
export function whatsappDisplay(): string {
  const n = WHATSAPP_NUMBER.replace(/^55/, "");
  return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n;
}
