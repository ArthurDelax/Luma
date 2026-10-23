/**
 * Preço da Luma: plano único, mensal, sem comissão por pedido e sem fidelidade.
 *
 * - R$ 119,90 por mês por loja, com tudo incluído.
 * - A equipe da loja pode ter até 10 pessoas com acesso ao painel, sem custo extra.
 *
 * Valores em centavos para evitar erros de ponto flutuante. O valor enviado pelo
 * navegador nunca é usado para cobrar: a cobrança usa o link do plano (payments.ts).
 */

export const PLAN_PRICE_CENTS = 11990;
export const PLAN_PRICE = PLAN_PRICE_CENTS / 100;
export const MIN_USERS = 1;
export const MAX_USERS = 10;

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
