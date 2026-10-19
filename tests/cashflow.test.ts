import { test } from "node:test";
import assert from "node:assert/strict";
import { projectCash, receivableStatus } from "../src/lib/cashflow.ts";
import type { Bill, LumaData, Receivable, RecurringExpense } from "../src/lib/types.ts";

const T = "2026-10-18";
const base = (p: Partial<LumaData>): LumaData => ({ version: 1, bills: [], recurring: [], documents: [], readAlerts: [], ...p });
const bill = (p: Partial<Bill>): Bill => ({ id: Math.random().toString(36), description: "Conta", supplier: "Forn", amount: 100, dueDate: T, category: "Fornecedores", createdAt: "", updatedAt: "", ...p });
const rcb = (p: Partial<Receivable>): Receivable => ({ id: Math.random().toString(36), description: "Venda", customer: "Cliente", amount: 100, dueDate: T, createdAt: "", updatedAt: "", ...p });

test("saldo projetado soma entradas e saídas dia a dia", () => {
  const d = base({
    cash: { balance: 1000, balanceDate: T, updatedAt: "" },
    bills: [bill({ amount: 300, dueDate: "2026-10-20" }), bill({ amount: 50, dueDate: "2026-10-10" }) /* vencida: entra hoje */, bill({ amount: 999, dueDate: "2026-10-19", paidAt: "2026-10-01" })],
    receivables: [rcb({ amount: 200, dueDate: "2026-10-21" }), rcb({ amount: 500, dueDate: "2026-10-01" }) /* atrasado: fora */],
  });
  const p = projectCash(d, T, 10);
  assert.equal(p.days[0].balance, 950);
  assert.equal(p.days.find((x) => x.date === "2026-10-20")!.balance, 650);
  assert.equal(p.days.find((x) => x.date === "2026-10-21")!.balance, 850);
  assert.equal(p.totalOut, 350);
  assert.equal(p.totalIn, 200);
  assert.equal(p.end, 850);
  assert.equal(p.firstNegative, undefined);
  assert.deepEqual(p.overdueReceivables, { count: 1, total: 500 });
  assert.equal(p.items.find((x) => x.amount === 50)!.overdue, true);
});

test("recorrente não lançada entra; já lançada não duplica", () => {
  const rec: RecurringExpense = { id: "r1", description: "Aluguel", supplier: "Imob", amount: 1000, category: "Aluguel e condomínio", dayOfMonth: 25, frequency: "mensal", startDate: "2026-01-01", active: true, createdAt: "", updatedAt: "" };
  const p1 = projectCash(base({ recurring: [rec] }), T, 30);
  assert.equal(p1.totalOut, 1000);
  const p2 = projectCash(base({ recurring: [rec], bills: [bill({ amount: 1000, dueDate: "2026-10-25", recurringId: "r1", occurrenceDate: "2026-10-25" })] }), T, 30);
  assert.equal(p2.totalOut, 1000);
});

test("primeiro dia negativo e sugestões", () => {
  const d = base({
    cash: { balance: 1000, balanceDate: T, updatedAt: "" },
    bills: [
      bill({ amount: 900, dueDate: "2026-10-22", supplier: "EmbalaMais" }),
      bill({ amount: 700, dueDate: "2026-10-24", supplier: "Receita Federal", category: "Impostos e taxas" }),
      bill({ amount: 400, dueDate: "2026-10-24", supplier: "Agência" }),
    ],
    receivables: [rcb({ amount: 2000, dueDate: "2026-11-05", customer: "Cliente Grande" }), rcb({ amount: 300, dueDate: "2026-10-01", customer: "Atrasado" })],
  });
  const p = projectCash(d, T, 30);
  assert.ok(p.firstNegative);
  assert.equal(p.firstNegative.date, "2026-10-24");
  assert.equal(p.firstNegative.balance, -1000);
  assert.equal(p.firstNegative.daysAhead, 6);
  const kinds = p.suggestions.map((s) => s.kind);
  assert.deepEqual(kinds, ["cobrar", "antecipar", "negociar"]);
  const neg = p.suggestions.find((s) => s.kind === "negociar")!;
  assert.match(neg.detail, /EmbalaMais/);
  assert.doesNotMatch(neg.detail, /Receita Federal/); // imposto não é sugerido para adiar
  assert.equal(p.lowest.balance, -1000);
});

test("sem saldo informado começa do zero e marca hasBalance=false", () => {
  const p = projectCash(base({ bills: [bill({ amount: 10, dueDate: "2026-10-19" })] }), T, 5);
  assert.equal(p.hasBalance, false);
  assert.equal(p.firstNegative?.date, "2026-10-19");
});

test("saldo antigo é sinalizado", () => {
  assert.equal(projectCash(base({ cash: { balance: 1, balanceDate: "2026-10-01", updatedAt: "" } }), T, 5).stale, true);
});

test("situação da conta a receber", () => {
  assert.equal(receivableStatus({ dueDate: "2026-10-10" }, T), "atrasado");
  assert.equal(receivableStatus({ dueDate: "2026-10-30" }, T), "a_receber");
  assert.equal(receivableStatus({ dueDate: "2026-10-10", receivedAt: "2026-10-11" }, T), "recebido");
});

import { chargeLink, chargeMessage, waPhone } from "../src/lib/charge.ts";

test("celular para o WhatsApp", () => {
  assert.equal(waPhone("(62) 99304-7680"), "5562993047680");
  assert.equal(waPhone("+55 62 99304-7680"), "5562993047680");
  assert.equal(waPhone("062993047680"), "5562993047680");
  assert.equal(waPhone("1234"), null);
  assert.equal(waPhone(undefined), null);
});

test("mensagem de cobrança atrasada e a vencer", () => {
  const r = rcb({ customer: "João Silva", description: "Serviço de setembro", amount: 1500, dueDate: "2026-10-10", customerPhone: "62999990000" });
  const m = chargeMessage(r, T, "Empresa X", "contato@empresa.com");
  assert.match(m, /Olá, João Silva!/);
  assert.match(m, /venceu em 10\/10\/2026/);
  assert.match(m, /Pix na chave: contato@empresa.com/);
  assert.match(m, /— Empresa X/);
  assert.match(chargeMessage({ ...r, dueDate: "2026-10-30" }, T), /com vencimento em 30\/10\/2026/);
  assert.ok(chargeLink(r, T).startsWith("https://wa.me/5562999990000?text="));
  assert.ok(chargeLink({ ...r, customerPhone: "" }, T).startsWith("https://wa.me/?text="));
});
