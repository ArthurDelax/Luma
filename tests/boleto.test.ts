/**
 * Testes da validação de linha digitável e da extração de boletos.
 * Execute com: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildArrecadacaoLinha,
  buildBancarioLinha,
  dueDateFromFactor,
  isParseError,
  mod10,
  mod11Arrecadacao,
  mod11Bancario,
  parseLinhaDigitavel,
  type LinhaResult,
} from "../src/lib/boleto/linha.ts";
import { extractBoleto, type TextItem } from "../src/lib/boleto/extract.ts";
import { isValidCNPJ, parseBRL } from "../src/lib/format.ts";

const ok = (input: string, ref = "2026-10-13"): LinhaResult => {
  const r = parseLinhaDigitavel(input, ref);
  if (isParseError(r)) throw new Error(r.error);
  return r;
};

test("módulo 10 e módulo 11", () => {
  assert.equal(mod10("001905009"), 5);
  assert.equal(mod11Bancario("0019373700000001000500940144816060680935031"), 3);
  assert.equal(mod11Arrecadacao("0"), 0);
});

test("boleto bancário válido (exemplo público do Banco do Brasil)", () => {
  const r = ok("00190.50095 40144.816069 06809.350314 3 37370000000100");
  assert.equal(r.kind, "bancario");
  assert.equal(r.valid, true);
  assert.equal(r.amount, 1);
  assert.equal(r.bankCode, "001");
  assert.equal(r.barcode, "00193373700000001000500940144816060680935031");
});

test("código de barras de 44 dígitos é convertido para linha digitável", () => {
  const r = ok("00193373700000001000500940144816060680935031");
  assert.equal(r.digitable, "00190500954014481606906809350314337370000000100");
  assert.equal(r.valid, true);
});

test("boleto bancário com dígito alterado é rejeitado", () => {
  const r = ok("00190500954014481606906809350314337370000000101");
  assert.equal(r.valid, false);
  const bad = ok("00190500944014481606906809350314337370000000100");
  assert.equal(bad.checks[0].valid, false);
});

test("arrecadação módulo 10 e módulo 11 (exemplos públicos)", () => {
  const a = ok("836200000005 667800481000 180975657313 001589636081");
  assert.equal(a.kind, "arrecadacao");
  assert.equal(a.valid, true);
  assert.equal(a.amount, 66.78);
  const b = ok("846700000017435900240209024050002435842210108119");
  assert.equal(b.valid, true);
  assert.equal(b.amount, 143.59);
  assert.equal(b.dueDate, undefined, "arrecadação não codifica vencimento");
});

test("arrecadação com bloco alterado é rejeitada", () => {
  const r = ok("836200000005667800481000180975657313001589636082");
  assert.equal(r.valid, false);
});

test("linha gerada para dados de exemplo é válida e preserva valor/vencimento", () => {
  const l = buildBancarioLinha("341", "2026-11-10", 1234.56, "1234567890");
  const r = ok(l);
  assert.equal(r.valid, true);
  assert.equal(r.amount, 1234.56);
  assert.equal(r.dueDate, "2026-11-10");
  const a = ok(buildArrecadacaoLinha("6", "8", 99.9, "77"));
  assert.equal(a.valid, true);
  assert.equal(a.amount, 99.9);
});

test("fator de vencimento considera o reinício de 22/02/2025", () => {
  assert.equal(dueDateFromFactor(1000, "2025-03-01"), "2025-02-22");
  assert.equal(dueDateFromFactor(9999, "2025-01-01"), "2025-02-21");
  assert.equal(dueDateFromFactor(1000, "2000-07-01"), "2000-07-03");
});

test("entradas inválidas retornam erro amigável", () => {
  assert.ok(isParseError(parseLinhaDigitavel("123")));
  assert.ok(isParseError(parseLinhaDigitavel("")));
  assert.ok(isParseError(parseLinhaDigitavel("9".repeat(48))));
});

test("CNPJ e valores em reais", () => {
  assert.equal(isValidCNPJ("11.222.333/0001-81"), true);
  assert.equal(isValidCNPJ("11.222.333/0001-82"), false);
  assert.equal(parseBRL("R$ 1.234,56"), 1234.56);
  assert.equal(parseBRL("99,9"), 99.9);
  assert.equal(parseBRL("abc"), undefined);
});

/* ---------------- Extração a partir de PDFs de exemplo ---------------- */

const fx = (name: string) => new URL(`./fixtures/${name}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

async function pdfItems(path: string): Promise<TextItem[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(readFileSync(path)),
    isEvalSupported: false,
    standardFontDataUrl: fx("../../node_modules/pdfjs-dist/standard_fonts/"),
  });
  const doc = await task.promise;
  const items: TextItem[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    for (const it of content.items) {
      if ("str" in it) items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, page: p });
    }
  }
  await task.destroy();
  return items;
}


test("extrai os campos de um boleto bancário digital", async () => {
  const r = extractBoleto(await pdfItems(fx("boleto-bancario.pdf")), "2026-10-13");
  assert.equal(r.supplier, "Exemplo Serviços de Tecnologia Ltda");
  assert.equal(r.supplierCnpj, "11222333000181");
  assert.equal(r.payer, "Empresa Demonstração ME");
  assert.equal(r.amount, 1450.9);
  assert.equal(r.dueDate, "2026-11-10");
  assert.equal(r.documentNumber, "NF-2026/0457");
  assert.equal(r.bank, "237 – Bradesco");
  assert.equal(r.linha?.valid, true);
  assert.deepEqual(r.warnings, []);
});

test("avisa quando a linha digitável do PDF tem DV inválido", async () => {
  const r = extractBoleto(await pdfItems(fx("boleto-dv-invalido.pdf")), "2026-10-13");
  assert.equal(r.linha?.valid, false);
  assert.ok(r.warnings.some((w) => w.includes("dígitos verificadores")));
});

test("lê conta de arrecadação sem inventar beneficiário", async () => {
  const r = extractBoleto(await pdfItems(fx("conta-arrecadacao.pdf")), "2026-10-13");
  assert.equal(r.linha?.kind, "arrecadacao");
  assert.equal(r.amount, 287.4);
  assert.equal(r.dueDate, "2026-10-25");
  assert.equal(r.supplier, undefined);
});

test("PDF digitalizado (sem texto) gera aviso e nenhum campo", async () => {
  const r = extractBoleto(await pdfItems(fx("digitalizado.pdf")), "2026-10-13");
  assert.equal(r.textLength, 0);
  assert.deepEqual(r.found, {});
  assert.ok(r.warnings[0].includes("digitalizada"));
});

test("PDF sem boleto não preenche campos", async () => {
  const r = extractBoleto(await pdfItems(fx("sem-boleto.pdf")), "2026-10-13");
  assert.equal(r.digitableLine, undefined);
  assert.equal(r.amount, undefined);
});
