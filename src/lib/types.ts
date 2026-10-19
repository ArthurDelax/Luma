/**
 * Modelos de dados da Luma.
 *
 * Todas as datas são strings ISO no formato "AAAA-MM-DD" (sem fuso horário),
 * o que evita erros de um dia causados por conversões de fuso.
 */

export type ISODate = string;

export type BillStatus = "pendente" | "pago" | "vencido";

export interface AttachmentMeta {
  /** Identificador do arquivo no IndexedDB do navegador. */
  id: string;
  name: string;
  size: number;
  type: string;
  addedAt: string;
}

export interface Bill {
  id: string;
  description: string;
  supplier: string;
  supplierCnpj?: string;
  amount: number;
  dueDate: ISODate;
  category: string;
  documentNumber?: string;
  /** Linha digitável apenas com dígitos. */
  digitableLine?: string;
  bank?: string;
  payer?: string;
  /** Chave Pix do recebedor (CPF, CNPJ, e-mail, celular ou chave aleatória). */
  pixKey?: string;
  /** Código Pix Copia e Cola (BR Code), quando houver. */
  pixCopiaECola?: string;
  notes?: string;
  /** Preenchido quando a conta foi paga. O status "pago" deriva deste campo. */
  paidAt?: ISODate;
  attachment?: AttachmentMeta;
  /** Quando a conta foi lançada a partir de uma despesa recorrente. */
  recurringId?: string;
  occurrenceDate?: ISODate;
  source?: "manual" | "boleto" | "recorrente" | "exemplo";
  createdAt: string;
  updatedAt: string;
}

export type Frequency = "mensal" | "trimestral" | "anual";

export interface RecurringExpense {
  id: string;
  description: string;
  supplier?: string;
  amount: number;
  category: string;
  dayOfMonth: number;
  frequency: Frequency;
  startDate: ISODate;
  endDate?: ISODate;
  active: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type DocKind = "contrato" | "documento";
export type DocStatus = "ativo" | "em_renovacao" | "encerrado";

export interface BusinessDocument {
  id: string;
  name: string;
  kind: DocKind;
  /** Ex.: "Contrato com fornecedor", "Alvará", "Certificado digital"… */
  type: string;
  party: string;
  startDate?: ISODate;
  endDate: ISODate;
  notes?: string;
  status: DocStatus;
  attachment?: AttachmentMeta;
  createdAt: string;
  updatedAt: string;
}

/** Valor que a empresa tem para receber (venda, serviço, parcela de cliente). */
export interface Receivable {
  id: string;
  description: string;
  /** Cliente que vai pagar. */
  customer: string;
  /** CPF ou CNPJ do cliente (opcional). */
  customerDoc?: string;
  /** Celular/WhatsApp do cliente, só dígitos (para a cobrança). */
  customerPhone?: string;
  amount: number;
  dueDate: ISODate;
  category?: string;
  /** Preenchido quando o valor entrou. */
  receivedAt?: ISODate;
  notes?: string;
  source?: "manual" | "importado" | "extrato" | "exemplo";
  createdAt: string;
  updatedAt: string;
}

/** Caixa da empresa: saldo informado e dados usados nas cobranças. */
export interface CashSettings {
  /** Saldo disponível (soma das contas da empresa) na data informada. */
  balance: number;
  balanceDate: ISODate;
  /** Chave Pix da empresa, enviada nas mensagens de cobrança. */
  pixKey?: string;
  updatedAt: string;
}

/** Categoria criada pela empresa, além das categorias padrão. */
export interface CustomCategory {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface LumaData {
  version: 1;
  bills: Bill[];
  recurring: RecurringExpense[];
  documents: BusinessDocument[];
  /** Categorias próprias da empresa (as padrão ficam em CATEGORIES). */
  categories?: CustomCategory[];
  /** Contas a receber. */
  receivables?: Receivable[];
  /** Saldo em caixa e chave Pix para cobranças. */
  cash?: CashSettings;
  /** IDs de alertas já lidos (o ID inclui o nível, então um novo nível volta a aparecer). */
  readAlerts: string[];
  /** Data em que os dados de exemplo foram gerados. */
  seededAt?: string;
}
