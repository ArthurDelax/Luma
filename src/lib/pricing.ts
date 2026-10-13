/**
 * Regras de preço da Luma (mensal, sem descontos e sem cobrança anual).
 *
 * - Mensalidade mínima de R$ 99,90, que inclui até 2 usuários.
 * - Cada usuário adicional custa R$ 29,90.
 * - Limite atual: 10 usuários.
 *
 * Valores em centavos para evitar erros de ponto flutuante. No SaaS comercial,
 * o backend recalcula o preço com estas mesmas regras — o valor enviado pelo
 * navegador nunca é usado para cobrar.
 */

export const BASE_PRICE_CENTS = 9990;
export const INCLUDED_USERS = 2;
export const EXTRA_USER_CENTS = 2990;
export const MIN_USERS = 1;
export const MAX_USERS = 10;

export function isValidUserCount(users: number): boolean {
  return Number.isInteger(users) && users >= MIN_USERS && users <= MAX_USERS;
}

/** Mensalidade em centavos para a quantidade de usuários (licenças). */
export function monthlyPriceCents(users: number): number {
  if (!isValidUserCount(users)) throw new RangeError(`Quantidade de usuários inválida: ${users}`);
  return BASE_PRICE_CENTS + Math.max(0, users - INCLUDED_USERS) * EXTRA_USER_CENTS;
}

export function monthlyPrice(users: number): number {
  return monthlyPriceCents(users) / 100;
}

export function priceBreakdown(users: number) {
  const extra = Math.max(0, users - INCLUDED_USERS);
  return {
    users,
    base: BASE_PRICE_CENTS / 100,
    extraUsers: extra,
    extraTotal: (extra * EXTRA_USER_CENTS) / 100,
    total: monthlyPrice(users),
  };
}

export const PRICE_TABLE = Array.from({ length: MAX_USERS }, (_, i) => ({ users: i + 1, total: monthlyPrice(i + 1) }));
