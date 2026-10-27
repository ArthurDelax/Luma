/**
 * Preço da Luma: plano único, sem comissão por pedido e sem fidelidade.
 *
 * - Mensal: R$ 119,90 por mês por loja + implantação de R$ 197 (uma vez), que
 *   paga a montagem do cardápio, o ajuste das fotos e os QR Codes das mesas.
 * - Anual: R$ 1.199 à vista (12 meses pelo preço de 10) com implantação grátis.
 * - A equipe da loja pode ter até 10 pessoas com acesso ao painel, sem custo extra.
 *
 * Valores em centavos para evitar erros de ponto flutuante. O valor enviado pelo
 * navegador nunca é usado para cobrar: a cobrança usa o link do plano (payments.ts).
 */

export const PLAN_PRICE_CENTS = 11990;
export const PLAN_PRICE = PLAN_PRICE_CENTS / 100;
export const SETUP_PRICE_CENTS = 19700;
export const SETUP_PRICE = SETUP_PRICE_CENTS / 100;
export const ANNUAL_PRICE_CENTS = PLAN_PRICE_CENTS * 10;
export const ANNUAL_PRICE = ANNUAL_PRICE_CENTS / 100;
export const MIN_USERS = 1;
export const MAX_USERS = 10;

export type Billing = "mensal" | "anual";

export function isValidUserCount(users: number): boolean {
  return Number.isInteger(users) && users >= MIN_USERS && users <= MAX_USERS;
}

/** Mensalidade em centavos: a mesma para qualquer tamanho de equipe dentro do limite. */
export function monthlyPriceCents(users = MIN_USERS): number {
  if (!isValidUserCount(users)) throw new RangeError(`Quantidade de usuários inválida: ${users}`);
  return PLAN_PRICE_CENTS;
}

export function monthlyPrice(users = MIN_USERS): number {
  return monthlyPriceCents(users) / 100;
}

/** Quanto o cliente paga para começar em cada forma de pagamento. */
export function firstPayment(billing: Billing): { total: number; setup: number; plan: number } {
  return billing === "anual" ? { total: ANNUAL_PRICE, setup: 0, plan: ANNUAL_PRICE } : { total: PLAN_PRICE + SETUP_PRICE, setup: SETUP_PRICE, plan: PLAN_PRICE };
}
