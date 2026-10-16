/**
 * "Pacote do contador": junta o fechamento de um mês em arquivos prontos para
 * enviar à contabilidade (planilhas + boletos em PDF + um resumo em texto).
 * Esta parte é pura (sem navegador); quem baixa os PDFs e monta o .zip é a tela.
 */

import { toCSV } from "./csv.ts";
import { endOfMonth, formatDate, monthLabel, startOfMonth } from "./dates.ts";
import { billStatus, STATUS_LABEL } from "./domain.ts";
import { formatBRL, formatCNPJ } from "./format.ts";
import type { Bill, ISODate } from "./types.ts";

export interface PackageFile {
  name: string;
  text: string;
}

export interface PackagePlan {
  /** "2026-09" */
  month: string;
  paid: Bill[];
  open: Bill[];
  totalPaid: number;
  totalOpen: number;
  /** Contas pagas com PDF anexado: onde cada PDF entra no .zip. */
  attachments: { bill: Bill; path: string }[];
  files: PackageFile[];
  /** Nome sugerido do .zip. */
  zipName: string;
}

const BOM = "﻿";

function safeName(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function sumOf(bills: Bill[]) {
  return bills.reduce((s, b) => s + b.amount, 0);
}

export function planAccountantPackage(bills: Bill[], month: string, today: ISODate, companyName?: string): PackagePlan {
  const from = startOfMonth(`${month}-01`);
  const to = endOfMonth(from);
  const inMonth = (d?: string) => !!d && d >= from && d <= to;

  const paid = bills.filter((b) => inMonth(b.paidAt)).sort((a, b) => a.paidAt!.localeCompare(b.paidAt!) || a.dueDate.localeCompare(b.dueDate));
  // vencem no mês e não foram pagas até o fim do mês
  const open = bills.filter((b) => inMonth(b.dueDate) && (!b.paidAt || b.paidAt > to)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const attachments = paid
    .filter((b) => b.attachment)
    .map((b) => {
      const ext = /\.[a-z0-9]{2,4}$/i.exec(b.attachment!.name)?.[0]?.toLowerCase() ?? ".pdf";
      return { bill: b, path: `boletos/${b.paidAt} - ${safeName(b.supplier)} - ${safeName(b.description)}${ext}` };
    });
  const pathOf = new Map(attachments.map((a) => [a.bill.id, a.path]));

  const paidCsv = toCSV(
    ["Data do pagamento", "Vencimento", "Descrição", "Fornecedor", "CNPJ", "Categoria", "Valor", "Nº documento", "Linha digitável", "Arquivo no pacote"],
    paid.map((b) => [
      formatDate(b.paidAt),
      formatDate(b.dueDate),
      b.description,
      b.supplier,
      b.supplierCnpj ? formatCNPJ(b.supplierCnpj) : "",
      b.category,
      b.amount,
      b.documentNumber,
      b.digitableLine,
      pathOf.get(b.id) ?? "",
    ]),
  );

  const byCat = new Map<string, { n: number; total: number }>();
  for (const b of paid) {
    const c = byCat.get(b.category) ?? { n: 0, total: 0 };
    c.n++;
    c.total += b.amount;
    byCat.set(b.category, c);
  }
  const cats = Array.from(byCat, ([cat, v]) => ({ cat, ...v })).sort((a, b) => b.total - a.total);
  const catCsv = toCSV(["Categoria", "Quantidade", "Total pago"], [...cats.map((c) => [c.cat, String(c.n), c.total]), ["Total", String(paid.length), sumOf(paid)]]);

  const openCsv = toCSV(
    ["Vencimento", "Descrição", "Fornecedor", "Categoria", "Valor", "Situação"],
    open.map((b) => [formatDate(b.dueDate), b.description, b.supplier, b.category, b.amount, b.paidAt ? `Paga em ${formatDate(b.paidAt)}` : STATUS_LABEL[billStatus(b, today)]]),
  );

  const title = monthLabel(month, false);
  const readme = [
    `Pacote do contador — ${title}`,
    ...(companyName ? [`Empresa: ${companyName}`] : []),
    `Gerado pela Luma em ${formatDate(today)}.`,
    "",
    `Contas pagas no mês: ${paid.length} — total ${formatBRL(sumOf(paid))}`,
    ...cats.map((c) => `  • ${c.cat}: ${formatBRL(c.total)} (${c.n})`),
    "",
    `Contas com vencimento no mês que ficaram em aberto: ${open.length} — total ${formatBRL(sumOf(open))}`,
    `Boletos em PDF incluídos: ${attachments.length} de ${paid.length} contas pagas.`,
    "",
    "Arquivos:",
    "  1-contas-pagas.csv ........ todas as contas pagas no mês (abre no Excel)",
    "  2-resumo-por-categoria.csv  total pago por categoria",
    "  3-contas-em-aberto.csv .... contas do mês ainda não pagas",
    "  boletos/ .................. PDFs dos boletos pagos que estavam anexados",
  ].join("\r\n");

  return {
    month,
    paid,
    open,
    totalPaid: sumOf(paid),
    totalOpen: sumOf(open),
    attachments,
    files: [
      { name: "LEIA-ME.txt", text: readme },
      { name: "1-contas-pagas.csv", text: BOM + paidCsv },
      { name: "2-resumo-por-categoria.csv", text: BOM + catCsv },
      { name: "3-contas-em-aberto.csv", text: BOM + openCsv },
    ],
    zipName: `luma-contador-${month}${companyName ? `-${safeName(companyName).replace(/\s+/g, "-").toLowerCase()}` : ""}.zip`,
  };
}
