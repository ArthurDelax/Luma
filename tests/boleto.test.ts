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

/* ---------------- Pix ---------------- */

import { buildPixPayload, classifyPixKey, crc16, findPixKeyInText, parsePixPayload } from "../src/lib/boleto/pix.ts";

test("Pix: exemplo oficial do Banco Central (CRC e campos)", () => {
  const ex = "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D";
  const p = parsePixPayload(ex);
  assert.ok(p);
  assert.equal(p.crcValid, true);
  assert.equal(p.key, "123e4567-e12b-12d1-a456-426655440000");
  assert.equal(p.keyType, "aleatoria");
  assert.equal(p.merchantName, "Fulano de Tal");
  assert.equal(p.merchantCity, "BRASILIA");
  assert.equal(p.amount, undefined);
  assert.equal(crc16(ex.slice(0, -4)), "1D3D");
});

test("Pix: CRC alterado é detectado e código que não é Pix é ignorado", () => {
  const ok = buildPixPayload({ key: "11222333000181", name: "Empresa", city: "SP", amount: 10 });
  const bad = ok.slice(0, -1) + (ok.endsWith("0") ? "1" : "0");
  assert.equal(parsePixPayload(bad)?.crcValid, false);
  assert.equal(parsePixPayload("000201010212"), undefined);
  assert.equal(parsePixPayload("qualquer texto"), undefined);
});

test("Pix: tipos de chave", () => {
  assert.equal(classifyPixKey("11.222.333/0001-81")?.type, "cnpj");
  assert.equal(classifyPixKey("529.982.247-25")?.type, "cpf");
  assert.equal(classifyPixKey("529.982.247-26"), undefined);
  assert.equal(classifyPixKey("Financeiro@Empresa.com.br")?.key, "financeiro@empresa.com.br");
  assert.equal(classifyPixKey("+55 (11) 98765-4321")?.type, "telefone");
  assert.equal(classifyPixKey("123e4567-e12b-12d1-a456-426655440000")?.type, "aleatoria");
  assert.deepEqual(findPixKeyInText("Pague via Pix\nChave Pix (CNPJ): 11.222.333/0001-81\n"), { key: "11222333000181", type: "cnpj" });
  assert.deepEqual(findPixKeyInText("CHAVE PIX: pagamentos@fornecedor.com"), { key: "pagamentos@fornecedor.com", type: "email" });
});

test("boleto com Pix: lê chave e copia e cola impressos", async () => {
  const r = extractBoleto(await pdfItems(fx("boleto-pix.pdf")), "2026-10-13");
  assert.equal(r.digitableLine, "23790000172345678901723456789017616260000145090");
  assert.equal(r.pixKey, "11222333000181");
  assert.equal(r.pixKeyType, "cnpj");
  assert.equal(r.pix?.crcValid, true);
  assert.equal(r.pix?.amount, 1450.9);
  assert.ok(r.pixCopiaECola?.startsWith("000201"));
  assert.deepEqual(r.warnings, []);
});

test("boleto com Pix de outro recebedor gera alerta", async () => {
  const r = extractBoleto(await pdfItems(fx("boleto-pix-divergente.pdf")), "2026-10-13");
  assert.equal(r.pixKeyType, "aleatoria");
  assert.ok(r.warnings.some((w) => w.includes("não parece ser o beneficiário")));
});

test("cobrança só com QR Code Pix usa os dados do QR", async () => {
  const pay = JSON.parse(readFileSync(fx("linhas.json"), "utf8")).pix.somente as string;
  const r = extractBoleto(await pdfItems(fx("pix-somente-qr.pdf")), "2026-10-13", { qrCodes: [pay] });
  assert.equal(r.pixKey, "financeiro@exemplo-fornecedor.com.br");
  assert.equal(r.amount, 250);
  assert.equal(r.supplier, "FORNECEDOR EXEMPLO LTDA");
  assert.equal(r.found.pixCopiaECola, "QR Code Pix (CRC conferido)");
  assert.ok(r.warnings.some((w) => w.includes("cobrança via Pix")));
});

test("PDF digitalizado com QR Code Pix ainda aproveita o QR", async () => {
  const pay = JSON.parse(readFileSync(fx("linhas.json"), "utf8")).pix.somente as string;
  const r = extractBoleto(await pdfItems(fx("digitalizado-com-qr.pdf")), "2026-10-13", { qrCodes: [pay] });
  assert.equal(r.textLength, 0);
  assert.equal(r.amount, 250);
  assert.ok(r.warnings[0].includes("QR Code Pix"));
});

test("guia do FGTS Digital (GFD): valor, vencimento, empregador e competência", async () => {
  const r = extractBoleto(await pdfItems(fx("guia-fgts.pdf")), "2026-10-13");
  assert.equal(r.guide, "FGTS");
  assert.equal(r.amount, 129.68);
  assert.equal(r.dueDate, "2026-10-20");
  assert.equal(r.payer, "EMPRESA EXEMPLO LTDA — CNPJ 11.222.333");
  assert.equal(r.supplier, "FGTS Digital (Caixa Econômica Federal)");
  assert.equal(r.description, "FGTS — competência 09/2026");
  assert.equal(r.category, "Folha e encargos");
  assert.equal(r.documentNumber, "0100000000000000-1");
  assert.equal(r.pix?.crcValid, true);
  assert.equal(r.pix?.dynamic, true);
  assert.deepEqual(r.warnings, []);
});

/* ---------------- Código de barras lido da imagem (PDF sem texto) ---------------- */

import { decodeRow } from "../src/lib/boleto/itf.ts";

const DARF_BARCODE = "85810000012345603852630007162630012345678123"; // fictício: R$ 1.234,56, venc. 27/10/2026

/** Gera as larguras (barra, espaço, …) de um código Intercalado 2 de 5, como numa imagem. */
function itfRuns(code: string, narrow = 2, wide = 6): number[] {
  const P: Record<string, string> = { "0": "nnwwn", "1": "wnnnw", "2": "nwnnw", "3": "wwnnn", "4": "nnwnw", "5": "wnwnn", "6": "nwwnn", "7": "nnnww", "8": "wnnwn", "9": "nwnwn" };
  const runs = [narrow, narrow, narrow, narrow];
  for (let i = 0; i < code.length; i += 2) {
    for (let j = 0; j < 5; j++) runs.push(P[code[i]][j] === "w" ? wide : narrow, P[code[i + 1]][j] === "w" ? wide : narrow);
  }
  runs.push(wide, narrow, narrow);
  return runs;
}

test("DARF: código de barras traz vencimento (AADDD) e número do documento", () => {
  const r = parseLinhaDigitavel(DARF_BARCODE, "2026-10-01");
  assert.ok(!isParseError(r));
  assert.equal(r.valid, true);
  assert.equal(r.amount, 1234.56);
  assert.equal(r.dueDate, "2026-10-27");
  assert.equal(r.documentNumber, "07.16.26300.1234567-8");
  assert.equal(r.agency, "Receita Federal");
});

test("arrecadação comum (não Receita) continua sem vencimento", () => {
  const l = buildArrecadacaoLinha("2", "6", 287.4, "0123456789012345678901234567");
  const r = parseLinhaDigitavel(l);
  assert.ok(!isParseError(r));
  assert.equal(r.dueDate, undefined);
  assert.equal(r.agency, undefined);
});

test("leitor de código de barras: decodifica larguras com ruído e recusa código adulterado", () => {
  const runs = itfRuns(DARF_BARCODE).map((w, i) => w + (i % 7 === 0 ? 1 : 0)); // pequenas variações de largura
  assert.equal(decodeRow([3, 9, ...runs, 9]), DARF_BARCODE); // com outras barras antes
  assert.equal(decodeRow(runs), DARF_BARCODE);
  const broken = DARF_BARCODE.slice(0, 10) + (DARF_BARCODE[10] === "9" ? "0" : String(Number(DARF_BARCODE[10]) + 1)) + DARF_BARCODE.slice(11);
  assert.equal(decodeRow(itfRuns(broken)), null);
});

test("PDF sem texto: usa o código de barras da imagem (DARF/INSS)", () => {
  const r = extractBoleto([], "2026-10-01", { barcodes: [DARF_BARCODE] });
  assert.equal(r.amount, 1234.56);
  assert.equal(r.dueDate, "2026-10-27");
  assert.equal(r.documentNumber, "07.16.26300.1234567-8");
  assert.equal(r.supplier, "Receita Federal");
  assert.equal(r.guide, "DARF");
  assert.equal(r.category, "Impostos e taxas");
  assert.equal(r.digitableLine?.length, 48);
  assert.match(r.warnings[0], /código de barras/);
});

test("boleto bancário sem texto: valor e vencimento pelo código de barras da imagem", () => {
  const r = extractBoleto([], "2026-10-13", { barcodes: ["34195164100002875401091234567812345678901230"] });
  assert.equal(r.amount, 2875.4);
  assert.equal(r.dueDate, "2026-11-25");
  assert.equal(r.bank, "341 – Itaú Unibanco");
  assert.equal(r.digitableLine?.length, 47);
});

test("texto embaralhado (sem linha válida): usa o código de barras da imagem", () => {
  const items: TextItem[] = ["Beneficiário", "Fornecedor Teste Ltda", "∆∑ø¥ˆ¨ 3419X.Y1091 23456.7812Z", "Vencimento", "25/11/2026"].map((str, i) => ({ str, x: 50, y: 700 - i * 14, w: 100, page: 1 }));
  const r = extractBoleto(items, "2026-10-13", { barcodes: ["34195164100002875401091234567812345678901230"] });
  assert.equal(r.amount, 2875.4);
  assert.equal(r.dueDate, "2026-11-25");
  assert.equal(r.found.digitableLine, "código de barras (DV conferido)");
});

test("layout fora do padrão: vencimento e valor por aproximação, com aviso", () => {
  const items: TextItem[] = ["Fatura de serviços", "Pagar até o dia 05/12/2026", "Total R$ 1.980,00", "Desconto R$ 20,00"].map((str, i) => ({ str, x: 50, y: 700 - i * 14, w: 100, page: 1 }));
  const r = extractBoleto(items, "2026-10-13");
  assert.equal(r.dueDate, "2026-12-05");
  assert.equal(r.amount, 1980);
  assert.ok(r.warnings.some((w) => /aproximação/.test(w)));
});
