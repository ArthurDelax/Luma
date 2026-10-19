/**
 * Dados fictícios exibidos na primeira abertura da demonstração.
 * As datas são calculadas a partir de "hoje" para que o painel sempre tenha
 * contas vencidas, a vencer e pagas. Nomes e valores são inventados.
 */

import { buildBancarioLinha } from "./boleto/linha.ts";
import { addDays, addMonthsClamped, startOfMonth } from "./dates.ts";
import type { Bill, BusinessDocument, LumaData, Receivable, RecurringExpense } from "./types.ts";

export function createSeedData(today: string): LumaData {
  const now = new Date().toISOString();
  const month0 = startOfMonth(today);
  const m = (offset: number, day: number) => addMonthsClamped(month0, offset, day);
  let n = 0;
  const id = (p: string) => `${p}_exemplo_${++n}`;

  const recurring: RecurringExpense[] = [
    { id: "rec_aluguel", description: "Aluguel do escritório", supplier: "Imobiliária Horizonte (fictícia)", amount: 4800, category: "Aluguel e condomínio", dayOfMonth: 5, frequency: "mensal", startDate: m(-8, 1), active: true },
    { id: "rec_internet", description: "Internet fibra 600 Mb", supplier: "Conecta Telecom (fictícia)", amount: 289.9, category: "Internet e telefonia", dayOfMonth: 12, frequency: "mensal", startDate: m(-8, 1), active: true },
    { id: "rec_contab", description: "Honorários contábeis", supplier: "Prisma Contabilidade (fictícia)", amount: 1350, category: "Contabilidade e jurídico", dayOfMonth: 10, frequency: "mensal", startDate: m(-8, 1), active: true },
    { id: "rec_erp", description: "Assinatura do sistema de notas fiscais", supplier: "NotaFácil Software (fictícia)", amount: 189, category: "Software e assinaturas", dayOfMonth: 20, frequency: "mensal", startDate: m(-6, 1), active: true },
    { id: "rec_seguro", description: "Seguro patrimonial", supplier: "Amparo Seguros (fictícia)", amount: 2640, category: "Seguros", dayOfMonth: 15, frequency: "trimestral", startDate: m(-5, 1), active: true },
    { id: "rec_dominio", description: "Domínio e hospedagem do site", supplier: "Nuvem Simples (fictícia)", amount: 720, category: "Software e assinaturas", dayOfMonth: 28, frequency: "anual", startDate: m(-10, 1), active: true },
    { id: "rec_limpeza", description: "Serviço de limpeza", supplier: "Brilho Serviços (fictícia)", amount: 980, category: "Manutenção", dayOfMonth: 25, frequency: "mensal", startDate: m(-12, 1), endDate: m(-2, 1), active: false },
  ].map((r) => ({ ...r, createdAt: now, updatedAt: now })) as RecurringExpense[];

  const bills: Bill[] = [];
  const add = (b: Omit<Bill, "id" | "createdAt" | "updatedAt" | "source"> & { withLine?: boolean; bankCode?: "341" | "237" }) => {
    const { withLine, bankCode = "341", ...rest } = b;
    const bill: Bill = { ...rest, id: id("cta"), source: "exemplo", createdAt: now, updatedAt: now };
    if (withLine) {
      bill.digitableLine = buildBancarioLinha(bankCode, bill.dueDate, bill.amount, String(1_000_000 + n * 7919));
      bill.bank = bankCode === "341" ? "341 – Itaú Unibanco" : "237 – Bradesco";
    }
    bills.push(bill);
  };

  // Lançamentos das despesas recorrentes nos meses anteriores (pagos) e no mês atual.
  for (let off = -5; off <= 0; off++) {
    for (const r of recurring.filter((r) => r.frequency === "mensal" && r.active)) {
      const due = m(off, r.dayOfMonth);
      if (due < r.startDate) continue;
      const paid = off < 0 || due < addDays(today, -1);
      // deixa a internet do mês atual vencida e sem pagamento para demonstrar alertas
      const leaveOpen = off === 0 && (r.id === "rec_internet" || due >= today);
      bills.push({
        id: id("cta"),
        description: r.description,
        supplier: r.supplier ?? r.description,
        amount: r.amount + (r.id === "rec_contab" && off === -2 ? 150 : 0),
        dueDate: due,
        category: r.category,
        recurringId: r.id,
        occurrenceDate: due,
        paidAt: paid && !leaveOpen ? addDays(due, -1) : undefined,
        source: "exemplo",
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Contas avulsas
  add({ description: "Energia elétrica", supplier: "Distribuidora Luz Norte (fictícia)", amount: 742.35, dueDate: m(-4, 18), category: "Energia", paidAt: m(-4, 17) });
  add({ description: "Energia elétrica", supplier: "Distribuidora Luz Norte (fictícia)", amount: 815.1, dueDate: m(-3, 18), category: "Energia", paidAt: m(-3, 18) });
  add({ description: "Energia elétrica", supplier: "Distribuidora Luz Norte (fictícia)", amount: 903.62, dueDate: m(-2, 18), category: "Energia", paidAt: m(-2, 16) });
  add({ description: "Energia elétrica", supplier: "Distribuidora Luz Norte (fictícia)", amount: 868.4, dueDate: m(-1, 18), category: "Energia", paidAt: m(-1, 18) });
  add({ description: "Energia elétrica", supplier: "Distribuidora Luz Norte (fictícia)", amount: 821.75, dueDate: addDays(today, 4), category: "Energia" });
  add({ description: "Água e esgoto", supplier: "Saneamento Vale Azul (fictícia)", amount: 168.2, dueDate: m(-2, 22), category: "Água e saneamento", paidAt: m(-2, 21) });
  add({ description: "Água e esgoto", supplier: "Saneamento Vale Azul (fictícia)", amount: 181.9, dueDate: m(-1, 22), category: "Água e saneamento", paidAt: m(-1, 22) });
  add({ description: "Água e esgoto", supplier: "Saneamento Vale Azul (fictícia)", amount: 236.4, dueDate: addDays(today, 9), category: "Água e saneamento" }); // acima da média: demonstra o aviso de conta que subiu
  add({ description: "Compra de materiais de escritório", supplier: "Papelaria Central (fictícia)", amount: 1236.8, dueDate: m(-3, 8), category: "Fornecedores", documentNumber: "NF 18.204", paidAt: m(-3, 8), withLine: true });
  add({ description: "Lote de embalagens personalizadas", supplier: "EmbalaMais Indústria (fictícia)", amount: 5420, dueDate: m(-1, 27), category: "Fornecedores", documentNumber: "NF 3.981", paidAt: m(-1, 26), withLine: true });
  add({ description: "Lote de embalagens personalizadas — 2ª parcela", supplier: "EmbalaMais Indústria (fictícia)", amount: 5420, dueDate: addDays(today, 2), category: "Fornecedores", documentNumber: "NF 3.981/2", withLine: true, bankCode: "237" }); // outro banco: demonstra o alerta de boleto suspeito
  add({ description: "Campanha de anúncios on-line", supplier: "Agência Pulso Digital (fictícia)", amount: 2300, dueDate: m(-2, 5), category: "Marketing", paidAt: m(-2, 5) });
  add({ description: "Campanha de anúncios on-line", supplier: "Agência Pulso Digital (fictícia)", amount: 2650, dueDate: addDays(today, -6), category: "Marketing", notes: "Aguardando aprovação do financeiro." });
  add({ description: "DAS — Simples Nacional", supplier: "Receita Federal", amount: 3187.44, dueDate: m(-1, 20), category: "Impostos e taxas", paidAt: m(-1, 19) });
  add({ description: "DAS — Simples Nacional", supplier: "Receita Federal", amount: 3412.9, dueDate: m(0, 20) < today ? m(1, 20) : m(0, 20), category: "Impostos e taxas" });
  add({ description: "Manutenção do ar-condicionado", supplier: "Clima Frio Serviços (fictícia)", amount: 640, dueDate: addDays(today, -2), category: "Manutenção", documentNumber: "OS 772" });
  add({ description: "Pró-labore e encargos", supplier: "Folha de pagamento", amount: 8900, dueDate: m(-1, 5), category: "Folha e encargos", paidAt: m(-1, 5) });
  add({ description: "Pró-labore e encargos", supplier: "Folha de pagamento", amount: 8900, dueDate: m(0, 5) < today ? m(1, 5) : m(0, 5), category: "Folha e encargos" });
  add({ description: "Licenças do pacote de escritório", supplier: "NotaFácil Software (fictícia)", amount: 1188, dueDate: m(-4, 2), category: "Software e assinaturas", paidAt: m(-4, 2) });
  add({ description: "Consultoria jurídica — revisão de contratos", supplier: "Moraes & Lima Advogados (fictício)", amount: 2800, dueDate: addDays(today, 16), category: "Contabilidade e jurídico" });

  const documents: BusinessDocument[] = [
    { id: id("doc"), name: "Contrato de locação — sede", kind: "contrato", type: "Contrato de locação", party: "Imobiliária Horizonte (fictícia)", startDate: addMonthsClamped(today, -22), endDate: addDays(today, 26), status: "ativo", notes: "Negociar reajuste antes da renovação." },
    { id: id("doc"), name: "Contrato de suporte de TI", kind: "contrato", type: "Contrato de prestação de serviços", party: "Rede Segura TI (fictícia)", startDate: addMonthsClamped(today, -11), endDate: addDays(today, 12), status: "em_renovacao" },
    { id: id("doc"), name: "Fornecimento de embalagens", kind: "contrato", type: "Contrato com fornecedor", party: "EmbalaMais Indústria (fictícia)", startDate: addMonthsClamped(today, -3), endDate: addMonthsClamped(today, 9), status: "ativo" },
    { id: id("doc"), name: "Seguro patrimonial", kind: "contrato", type: "Seguro empresarial", party: "Amparo Seguros (fictícia)", startDate: addMonthsClamped(today, -5), endDate: addMonthsClamped(today, 7), status: "ativo" },
    { id: id("doc"), name: "Certificado digital e-CNPJ A1", kind: "documento", type: "Certificado digital", party: "Responsável: financeiro", startDate: addMonthsClamped(today, -12), endDate: addDays(today, 3), status: "ativo", notes: "Necessário para emissão de notas fiscais." },
    { id: id("doc"), name: "Alvará de funcionamento", kind: "documento", type: "Alvará", party: "Prefeitura municipal", startDate: addMonthsClamped(today, -12), endDate: addDays(today, -4), status: "ativo" },
    { id: id("doc"), name: "Auto de vistoria do Corpo de Bombeiros", kind: "documento", type: "Licença", party: "Corpo de Bombeiros", startDate: addMonthsClamped(today, -20), endDate: addMonthsClamped(today, 4), status: "ativo" },
    { id: id("doc"), name: "Certidão negativa de débitos federais", kind: "documento", type: "Certidão", party: "Receita Federal", startDate: addDays(today, -160), endDate: addDays(today, 20), status: "ativo" },
  ].map((d) => ({ ...d, createdAt: now, updatedAt: now })) as BusinessDocument[];

  // Contas a receber (clientes fictícios). Uma atrasada para demonstrar a cobrança.
  const rc = (description: string, customer: string, amount: number, dueDate: string, extra: Partial<Receivable> = {}): Receivable => ({
    id: id("rcb"),
    description,
    customer,
    amount,
    dueDate,
    category: "Serviços",
    source: "exemplo",
    createdAt: now,
    updatedAt: now,
    ...extra,
  });
  const receivables: Receivable[] = [
    rc("Projeto de identidade visual — 2ª parcela", "Café Aurora (fictício)", 3200, addDays(today, -5)),
    rc("Manutenção mensal de sistemas", "Clínica Bem Viver (fictícia)", 2400, addDays(today, 3), { category: "Mensalidades de clientes" }),
    rc("Venda de lote de embalagens", "Mercado Bom Preço (fictício)", 4100, addDays(today, 9), { category: "Vendas" }),
    rc("Consultoria de processos", "Transportadora Rota Sul (fictícia)", 5800, addDays(today, 15)),
    rc("Implantação de sistema de pedidos", "Distribuidora Vale Verde (fictícia)", 4500, addDays(today, 24)),
    rc("Manutenção mensal de sistemas", "Clínica Bem Viver (fictícia)", 2400, addDays(today, 33), { category: "Mensalidades de clientes" }),
    rc("Pedido recorrente de embalagens", "Mercado Bom Preço (fictício)", 3900, addDays(today, 38), { category: "Vendas" }),
    rc("Treinamento da equipe", "Escola Saber Mais (fictícia)", 1800, addDays(today, -4), { receivedAt: addDays(today, -3) }),
    rc("Manutenção mensal de sistemas", "Clínica Bem Viver (fictícia)", 2400, addDays(today, -27), { receivedAt: addDays(today, -27), category: "Mensalidades de clientes" }),
  ];

  return {
    version: 1,
    bills,
    recurring,
    documents,
    receivables,
    cash: { balance: 17400, balanceDate: today, pixKey: "financeiro@empresademo.com.br", updatedAt: now },
    readAlerts: [],
    seededAt: now,
  };
}
