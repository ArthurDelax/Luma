/**
 * Link de pagamento do Asaas (assinatura mensal do plano único), criado no painel do Asaas.
 *
 * Segurança: aqui fica SÓ o link público de pagamento (o mesmo que você mandaria a
 * um cliente). Nunca coloque a chave de API do Asaas neste arquivo, no GitHub ou no
 * site — o site é público e qualquer pessoa vê o código.
 *
 * Como preencher: cole o link entre as aspas. Link vazio = o botão leva para o
 * WhatsApp no lugar do pagamento.
 *
 * ATENÇÃO: este repositório é PÚBLICO. Só preencha depois que a conta do Asaas
 * estiver com dados da empresa (CNPJ e contatos comerciais) — a página do link
 * mostra os dados do titular. Até lá, a venda é pelo WhatsApp e o link é
 * enviado na conversa.
 */

import { PLAN_PRICE_CENTS } from "./pricing.ts";

/** Plano único — R$ 119,90/mês */
export const PAYMENT_LINK = "";

/** Só aceita links do próprio Asaas (evita que um link trocado por engano mande o cliente para outro site). */
export function isAsaasLink(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "asaas.com" || u.hostname.endsWith(".asaas.com"));
  } catch {
    return false;
  }
}

export type Checkout = { kind: "link"; url: string; cents: number } | { kind: "whatsapp" };

/** O que o botão "Assinar" deve fazer. */
export function checkout(link: string = PAYMENT_LINK): Checkout {
  const url = link.trim();
  if (!url || !isAsaasLink(url)) return { kind: "whatsapp" };
  return { kind: "link", url, cents: PLAN_PRICE_CENTS };
}
