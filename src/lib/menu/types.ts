/**
 * Cardápio digital de uma loja.
 *
 * Tudo fica num único documento JSON (`menus.data` no banco): dados da loja,
 * categorias com os produtos, grupos de adicionais e cupons. O mesmo formato
 * alimenta o painel da loja, o cardápio público e a demonstração.
 */

export type HHMM = string; // "18:00"

/** Horário de um dia: [abre, fecha]; null = fechado. Fecha depois da meia-noite quando fecha <= abre. */
export type DayHours = [HHMM, HHMM] | null;

export interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
}

export interface HeroClip {
  url: string;
  label: string;
  /** segundo em que o trecho começa */
  start: number;
  /** quantos segundos fica na tela */
  len: number;
}

export interface StoreInfo {
  name: string;
  /** frase curta abaixo do nome (ex.: "Smash & artesanal · desde 2016") */
  tagline: string;
  /** título grande do topo */
  headline: string;
  description: string;
  /** cor principal da loja (hex) */
  accent: string;
  logoUrl?: string;
  coverUrl?: string;
  heroClips: HeroClip[];
  /** número que recebe os pedidos, só dígitos com DDI (ex.: 5511999999999) */
  whatsapp: string;
  address: string;
  city: string;
  instagram?: string;
  /** índice 0 = domingo … 6 = sábado */
  hours: DayHours[];
  delivery: { enabled: boolean; time: string; minFee?: number; freeFrom: number | null; zones: DeliveryZone[] };
  pickup: { enabled: boolean; time: string };
  /** pedido feito na mesa pelo QR Code (sem endereço nem taxa) */
  dineIn: { enabled: boolean; tables: number };
  minOrder: number;
  payments: { pix: boolean; card: boolean; cash: boolean };
  /** textos da faixa de promoções */
  promos: string[];
  /** aceitar pedidos fora do horário (o cliente é avisado que a loja está fechada) */
  acceptWhenClosed: boolean;
  rating?: { value: number; count: number };
}

export interface OptionChoice {
  name: string;
  price: number;
}

export interface OptionGroup {
  id: string;
  /** título mostrado ao cliente (ex.: "Turbine seu burger") */
  title: string;
  /** nome curto usado na mensagem do pedido (ex.: "Adicional") */
  label: string;
  type: "single" | "multi";
  required: boolean;
  /** limite de escolhas (multi) */
  max?: number;
  options: OptionChoice[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  image?: string;
  tag?: string;
  veg?: boolean;
  available: boolean;
  featured?: boolean;
  groupIds: string[];
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string;
  items: MenuItem[];
}

export interface Coupon {
  code: string;
  type: "pct" | "fix";
  value: number;
  active: boolean;
}

export interface MenuData {
  version: 1;
  store: StoreInfo;
  categories: MenuCategory[];
  groups: OptionGroup[];
  coupons: Coupon[];
}

/** Cardápio salvo: endereço público, se está no ar e o conteúdo. */
export interface MenuRecord {
  slug: string;
  published: boolean;
  data: MenuData;
  updatedAt?: string;
}
