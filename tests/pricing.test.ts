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
