import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyPrice, monthlyPriceCents, PRICE_TABLE, isValidUserCount } from "../src/lib/pricing.ts";

test("tabela de preços mensais", () => {
  const expected = [99.9, 99.9, 129.8, 159.7, 189.6, 219.5, 249.4, 279.3, 309.2, 339.1];
  assert.deepEqual(PRICE_TABLE.map((p) => p.total), expected);
  assert.equal(monthlyPriceCents(10), 33910);
});

test("quantidade fora do limite é recusada", () => {
  assert.equal(isValidUserCount(0), false);
  assert.equal(isValidUserCount(11), false);
  assert.equal(isValidUserCount(2.5), false);
  assert.throws(() => monthlyPrice(11), RangeError);
});

import { checkoutFor, isAsaasLink } from "../src/lib/payments.ts";

test("checkout: 1 e 2 usuários usam o mesmo link; acima de 6 vai para o WhatsApp", () => {
  const links = { 2: "https://www.asaas.com/c/abc123", 3: "https://www.asaas.com/c/def456", 4: "", 5: "", 6: "https://evil.example.com/pagar" };
  assert.deepEqual(checkoutFor(1, links), { kind: "link", url: "https://www.asaas.com/c/abc123", cents: 9990 });
  assert.deepEqual(checkoutFor(2, links), { kind: "link", url: "https://www.asaas.com/c/abc123", cents: 9990 });
  assert.equal(checkoutFor(3, links).kind, "link");
  assert.deepEqual(checkoutFor(4, links), { kind: "whatsapp", reason: "sem_link" });
  assert.deepEqual(checkoutFor(6, links), { kind: "whatsapp", reason: "sem_link" }); // link de fora do Asaas é recusado
  assert.deepEqual(checkoutFor(7, links), { kind: "whatsapp", reason: "acima_do_limite" });
});

test("só aceita links https do Asaas", () => {
  assert.equal(isAsaasLink("https://www.asaas.com/c/abc"), true);
  assert.equal(isAsaasLink("https://sandbox.asaas.com/c/abc"), true);
  assert.equal(isAsaasLink("http://www.asaas.com/c/abc"), false);
  assert.equal(isAsaasLink("https://asaas.com.golpe.net/c/abc"), false);
  assert.equal(isAsaasLink("javascript:alert(1)"), false);
});
