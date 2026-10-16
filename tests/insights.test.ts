import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBancarioLinha } from "../src/lib/boleto/linha.ts";
import { amountJump, bankCodeOf, riskSignals } from "../src/lib/insights.ts";
import type { Bill } from "../src/lib/types.ts";

const CNPJ_A = "11222333000181";
const CNPJ_B = "45997418000153";

let n = 0;
function bill(p: Partial<Bill>): Bill {
  n++;
  return {
    id: `b${n}`,
    description: "Conta",
    supplier: "EmbalaMais Indústria",
    amount: 100,
    dueDate: "2026-01-10",
    category: "Fornecedores",
    createdAt: "",
    updatedAt: "",
    ...p,
  };
}

const linha = (bank: string, due = "2026-10-18", amount = 5420) => buildBancarioLinha(bank, due, amount, "1234567890123456789012345");

test("código do banco vem da linha digitável ou do campo banco", () => {
  assert.equal(bankCodeOf({ digitableLine: linha("341") }), "341");
  assert.equal(bankCodeOf({ bank: "237 – Bradesco" }), "237");
  assert.equal(bankCodeOf({ digitableLine: "8".padEnd(48, "1") }), undefined); // arrecadação
  assert.equal(bankCodeOf({}), undefined);
});

test("sem histórico do fornecedor, nenhum aviso", () => {
  assert.deepEqual(riskSignals({ supplier: "Fornecedor Novo", digitableLine: linha("001") }, [bill({ digitableLine: linha("341") })]), []);
});

test("mesmo fornecedor por outro banco gera aviso", () => {
  const hist = [bill({ bank: "341 – Itaú Unibanco", digitableLine: linha("341", "2026-08-18") }), bill({ bank: "341 – Itaú Unibanco", digitableLine: linha("341", "2026-09-18") })];
  const s = riskSignals({ supplier: "EMBALAMAIS INDUSTRIA", bank: "237 – Bradesco", digitableLine: linha("237") }, hist);
  assert.equal(s.length, 1);
  assert.equal(s[0].kind, "banco");
  assert.match(s[0].message, /Itaú Unibanco/);
  assert.match(s[0].message, /Bradesco/);
  // mesmo banco: sem aviso
  assert.deepEqual(riskSignals({ supplier: "EmbalaMais Indústria", digitableLine: linha("341") }, hist), []);
});

test("mesmo nome com CNPJ diferente gera aviso", () => {
  const hist = [bill({ supplierCnpj: CNPJ_A })];
  const s = riskSignals({ supplier: "EmbalaMais Indústria", supplierCnpj: CNPJ_B }, hist);
  assert.deepEqual(s.map((x) => x.kind), ["cnpj"]);
  assert.deepEqual(riskSignals({ supplier: "EmbalaMais Indústria", supplierCnpj: CNPJ_A }, hist), []);
});

test("chave Pix diferente gera aviso", () => {
  const hist = [bill({ pixKey: "financeiro@embalamais.com.br" })];
  assert.deepEqual(riskSignals({ supplier: "EmbalaMais Indústria", pixKey: "outra@golpe.com" }, hist).map((x) => x.kind), ["pix"]);
  assert.deepEqual(riskSignals({ supplier: "EmbalaMais Indústria", pixKey: "Financeiro@EmbalaMais.com.br" }, hist), []);
});

test("a própria conta (edição) não conta como histórico", () => {
  const self = bill({ bank: "341 – Itaú" });
  assert.deepEqual(riskSignals({ ...self, bank: "237 – Bradesco" }, [self]), []);
});

test("conta bem acima da média avisa", () => {
  const hist = [bill({ supplier: "Luz Norte", amount: 800, dueDate: "2026-07-20" }), bill({ supplier: "Luz Norte", amount: 820, dueDate: "2026-08-20" }), bill({ supplier: "Luz Norte", amount: 780, dueDate: "2026-09-20" })];
  const j = amountJump({ supplier: "Luz Norte", amount: 1072, dueDate: "2026-10-20" }, hist);
  assert.ok(j);
  assert.equal(j.basedOn, 3);
  assert.equal(Math.round(j.average), 800);
  assert.equal(Math.round(j.increase * 100), 34);
});

test("aumento pequeno, poucos dados ou contas futuras não avisam", () => {
  const hist = [bill({ supplier: "Luz Norte", amount: 800, dueDate: "2026-08-20" }), bill({ supplier: "Luz Norte", amount: 800, dueDate: "2026-09-20" })];
  assert.equal(amountJump({ supplier: "Luz Norte", amount: 900, dueDate: "2026-10-20" }, hist), undefined); // 12,5%
  assert.equal(amountJump({ supplier: "Luz Norte", amount: 2000, dueDate: "2026-10-20" }, hist.slice(0, 1)), undefined); // só 1 anterior
  assert.equal(amountJump({ supplier: "Luz Norte", amount: 2000, dueDate: "2026-08-01" }, hist), undefined); // nada antes
  assert.equal(amountJump({ supplier: "Café", amount: 30, dueDate: "2026-10-20" }, [bill({ supplier: "Café", amount: 10, dueDate: "2026-08-01" }), bill({ supplier: "Café", amount: 10, dueDate: "2026-09-01" })]), undefined); // diferença < R$ 30
});

test("recorrente usa a mesma despesa mesmo com outro nome de fornecedor", () => {
  const hist = [bill({ supplier: "A", recurringId: "r1", amount: 500, dueDate: "2026-08-05" }), bill({ supplier: "B", recurringId: "r1", amount: 500, dueDate: "2026-09-05" })];
  assert.ok(amountJump({ supplier: "C", recurringId: "r1", amount: 700, dueDate: "2026-10-05" }, hist));
});

import { planAccountantPackage } from "../src/lib/accountant.ts";
import { buildZip, crc32 } from "../src/lib/zip.ts";

test("crc32 confere com o valor de referência", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("zip tem cabeçalhos válidos e nomes repetidos viram (2)", () => {
  const enc = new TextEncoder();
  const z = buildZip([{ name: "a.txt", data: enc.encode("oi") }, { name: "a.txt", data: enc.encode("tchau") }]);
  const v = new DataView(z.buffer);
  assert.equal(v.getUint32(0, true), 0x04034b50);
  assert.equal(v.getUint32(z.length - 22, true), 0x06054b50);
  assert.equal(v.getUint16(z.length - 22 + 10, true), 2);
  assert.ok(new TextDecoder().decode(z).includes("a (2).txt"));
});

test("pacote do contador separa pagas no mês e em aberto", () => {
  const bills = [
    bill({ description: "Luz", supplier: "Luz Norte", amount: 800, dueDate: "2026-09-20", paidAt: "2026-09-19", category: "Energia", attachment: { id: "x", name: "luz.PDF", size: 1, type: "application/pdf", addedAt: "" } }),
    bill({ description: "Aluguel", supplier: "Imob/Centro", amount: 4800, dueDate: "2026-09-05", paidAt: "2026-09-05", category: "Aluguel" }),
    bill({ description: "Internet", supplier: "Net", amount: 290, dueDate: "2026-09-12" }),
    bill({ description: "Agosto pago em setembro", supplier: "X", amount: 100, dueDate: "2026-08-30", paidAt: "2026-09-02", category: "Outros" }),
    bill({ description: "Outubro", supplier: "Y", amount: 50, dueDate: "2026-10-10", paidAt: "2026-10-01" }),
  ];
  const p = planAccountantPackage(bills, "2026-09", "2026-10-16", "Empresa Teste");
  assert.equal(p.paid.length, 3);
  assert.equal(p.totalPaid, 5700);
  assert.deepEqual(p.open.map((b) => b.description), ["Internet"]);
  assert.deepEqual(p.attachments.map((a) => a.path), ["boletos/2026-09-19 - Luz Norte - Luz.pdf"]);
  assert.match(p.files[0].text, /setembro de 2026/);
  assert.match(p.files[0].text, /Empresa: Empresa Teste/);
  assert.ok(p.files[1].text.startsWith("﻿"));
  assert.equal(p.zipName, "luma-contador-2026-09-empresa-teste.zip");
});
