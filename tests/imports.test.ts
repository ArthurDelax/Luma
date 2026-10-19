import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRows, guessMapping, parseCSV, parseDate } from "../src/lib/sheetImport.ts";
import { matchStatement, parseOFX } from "../src/lib/ofx.ts";
import type { Bill, Receivable } from "../src/lib/types.ts";

test("CSV com ponto e vírgula, aspas e BOM", () => {
  const t = parseCSV('﻿Fornecedor;Descrição;Valor;Vencimento\n"Luz; Norte";Energia;"1.234,56";20/10/2026\n\nImob;Aluguel;4800;2026-11-05\n');
  assert.deepEqual(t[0], ["Fornecedor", "Descrição", "Valor", "Vencimento"]);
  assert.deepEqual(t[1], ["Luz; Norte", "Energia", "1.234,56", "20/10/2026"]);
  assert.equal(t.length, 3);
});

test("CSV com vírgula e aspas duplas escapadas", () => {
  const t = parseCSV('nome,valor\n"Empresa ""X""",10.5\n');
  assert.deepEqual(t[1], ['Empresa "X"', "10.5"]);
});

test("adivinha colunas pelo cabeçalho", () => {
  const m = guessMapping(["Data do pagamento", "Cliente", "Histórico", "Valor (R$)", "Data de vencimento", "Celular"]);
  assert.deepEqual(m, { paidAt: 0, name: 1, description: 2, amount: 3, dueDate: 4, phone: 5 });
});

test("datas brasileiras e ISO", () => {
  assert.equal(parseDate("5/1/26"), "2026-01-05");
  assert.equal(parseDate("2026-02-30"), undefined);
  assert.equal(parseDate("2026-10-20T00:00"), "2026-10-20");
});

test("linhas: categoria conhecida, desconhecida vira Outros e erros", () => {
  const table = [["Fornecedor", "Valor", "Vencimento", "Categoria"], ["Luz Norte", "R$ 821,75", "20/10/2026", "energia"], ["Gráfica", "300", "21/10/2026", "Brindes"], ["", "abc", "x", ""]];
  const rows = buildRows(table, { name: 0, amount: 1, dueDate: 2, category: 3 }, "pagar");
  assert.equal(rows[0].category, "Energia");
  assert.equal(rows[0].amount, 821.75);
  assert.equal(rows[1].category, "Outros");
  assert.deepEqual(rows[2].errors, ["sem fornecedor/descrição", "valor inválido", "vencimento inválido"]);
  assert.equal(rows[2].line, 4);
});

const OFX = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261019120000[-3:BRT]<TRNAMT>-821.75<FITID>A1<MEMO>PAGTO ENERGIA
</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261022<TRNAMT>2400,00<FITID>A2<NAME>PIX RECEBIDO<MEMO>CLINICA
</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261023<TRNAMT>-55.90<FITID>A3<MEMO>TARIFA
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

test("lê OFX (SGML) com vírgula ou ponto", () => {
  const t = parseOFX(OFX);
  assert.equal(t.length, 3);
  assert.deepEqual(t[0], { id: "A1", date: "2026-10-19", amount: -821.75, memo: "PAGTO ENERGIA" });
  assert.equal(t[1].amount, 2400);
  assert.equal(t[1].memo, "PIX RECEBIDO — CLINICA");
});

test("cruza extrato com contas abertas", () => {
  const bill = (p: Partial<Bill>): Bill => ({ id: "b", description: "Energia", supplier: "Luz Norte", amount: 821.75, dueDate: "2026-10-20", category: "Energia", createdAt: "", updatedAt: "", ...p });
  const rcb = (p: Partial<Receivable>): Receivable => ({ id: "r", description: "Manutenção", customer: "Clínica", amount: 2400, dueDate: "2026-10-21", createdAt: "", updatedAt: "", ...p });
  const res = matchStatement(parseOFX(OFX), [bill({}), bill({ id: "b2", dueDate: "2026-12-20" }), bill({ id: "paga", paidAt: "2026-10-01" })], [rcb({})]);
  assert.deepEqual(res.matches.map((m) => [m.kind, m.targetId, m.gap]), [["pagar", "b", -1], ["receber", "r", 1]]);
  assert.deepEqual(res.unmatched.map((u) => u.id), ["A3"]);
});
