import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidUserCount, monthlyPrice, monthlyPriceCents, PLAN_PRICE } from "../src/lib/pricing.ts";
import { checkout, isAsaasLink } from "../src/lib/payments.ts";

test("plano único de R$ 119,90 para qualquer tamanho de equipe", () => {
  assert.equal(PLAN_PRICE, 119.9);
  assert.equal(monthlyPrice(), 119.9);
  assert.equal(monthlyPriceCents(1), 11990);
  assert.equal(monthlyPriceCents(10), 11990);
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
  assert.deepEqual(checkout("https://evil.example.com/pagar"), { kind: "whatsapp" }); // link de fora do Asaas é recusado
});

test("só aceita links https do Asaas", () => {
  assert.equal(isAsaasLink("https://www.asaas.com/c/abc"), true);
  assert.equal(isAsaasLink("https://sandbox.asaas.com/c/abc"), true);
  assert.equal(isAsaasLink("http://www.asaas.com/c/abc"), false);
  assert.equal(isAsaasLink("https://asaas.com.golpe.net/c/abc"), false);
  assert.equal(isAsaasLink("javascript:alert(1)"), false);
});
