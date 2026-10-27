import { test } from "node:test";
import assert from "node:assert/strict";
import { ANNUAL_PRICE, firstPayment, isValidUserCount, monthlyPrice, monthlyPriceCents, PLAN_PRICE, SETUP_PRICE } from "../src/lib/pricing.ts";
import { checkout, isAsaasLink } from "../src/lib/payments.ts";

test("plano mensal de R$ 119,90 para qualquer tamanho de equipe", () => {
  assert.equal(PLAN_PRICE, 119.9);
  assert.equal(monthlyPrice(), 119.9);
  assert.equal(monthlyPriceCents(1), 11990);
  assert.equal(monthlyPriceCents(10), 11990);
});

test("implantação no mensal e anual com 2 meses e implantação grátis", () => {
  assert.equal(SETUP_PRICE, 197);
  assert.equal(ANNUAL_PRICE, 1199);
  assert.deepEqual(firstPayment("mensal"), { total: 316.9, setup: 197, plan: 119.9 });
  assert.deepEqual(firstPayment("anual"), { total: 1199, setup: 0, plan: 1199 });
});

test("quantidade fora do limite é recusada", () => {
  assert.equal(isValidUserCount(0), false);
  assert.equal(isValidUserCount(11), false);
  assert.equal(isValidUserCount(2.5), false);
  assert.throws(() => monthlyPrice(11), RangeError);
});

test("checkout: link do Asaas ou WhatsApp", () => {
  assert.deepEqual(checkout("https://www.asaas.com/c/abc123"), { kind: "link", url: "https://www.asaas.com/c/abc123", cents: 11990 });
  assert.deepEqual(checkout(""), { kind: "whatsapp" });
  assert.deepEqual(checkout("https://evil.example.com/pagar"), { kind: "whatsapp" });
});

test("só aceita links https do Asaas", () => {
  assert.equal(isAsaasLink("https://www.asaas.com/c/abc"), true);
  assert.equal(isAsaasLink("https://sandbox.asaas.com/c/abc"), true);
  assert.equal(isAsaasLink("http://www.asaas.com/c/abc"), false);
  assert.equal(isAsaasLink("https://asaas.com.golpe.net/c/abc"), false);
  assert.equal(isAsaasLink("javascript:alert(1)"), false);
});
