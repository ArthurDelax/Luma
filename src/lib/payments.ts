/**
 * Links de pagamento do Asaas (assinatura mensal), criados no painel do Asaas.
 *
 * Segurança: aqui ficam SÓ os links públicos de pagamento (os mesmos que você
 * mandaria a um cliente). Nunca coloque a chave de API do Asaas neste arquivo,
 * no GitHub ou no site — o site é público e qualquer pessoa vê o código.
 *
 * Como preencher: cole o link de cada plano entre as aspas. Link vazio = o botão
 * leva para o WhatsApp no lugar do pagamento.
 */

import { isValidUserCount, monthlyPriceCents } from "./pricing.ts";

/** Até quantos usuários a contratação é online; acima disso, WhatsApp. */
export const ONLINE_MAX_USERS = 6;

/** Planos com link próprio (1 e 2 usuários têm o mesmo preço e usam o mesmo link). */
export const PAYMENT_LINKS: Record<2 | 3 | 4 | 5 | 6, string> = {
  2: "", // até 2 usuários — R$ 99,90/mês
  3: "", // 3 usuários — R$ 129,80/mês
  4: "", // 4 usuários — R$ 159,70/mês
  5: "", // 5 usuários — R$ 189,60/mês
  6: "", // 6 usuários — R$ 219,50/mês
};

/** Só aceita links do próprio Asaas (evita que um link trocado por engano mande o cliente para outro site). */
export function isAsaasLink(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "asaas.com" || u.hostname.endsWith(".asaas.com"));
  } catch {
    return false;
  }
}

export type Checkout = { kind: "link"; url: string; cents: number } | { kind: "whatsapp"; reason: "acima_do_limite" | "sem_link" };

/** O que o botão "Assinar" deve fazer para essa quantidade de usuários. */
export function checkoutFor(users: number, links: Record<number, string> = PAYMENT_LINKS): Checkout {
  if (!isValidUserCount(users) || users > ONLINE_MAX_USERS) return { kind: "whatsapp", reason: "acima_do_limite" };
  const tier = Math.max(2, users);
  const url = (links[tier] ?? "").trim();
  if (!url || !isAsaasLink(url)) return { kind: "whatsapp", reason: "sem_link" };
  return { kind: "link", url, cents: monthlyPriceCents(users) };
}
