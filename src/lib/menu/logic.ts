/**
 * Regras do cardápio sem tela: endereço, horário, preços do pedido, cupons e a
 * mensagem enviada pelo WhatsApp. Funções puras, cobertas por testes.
 */

import { formatBRL } from "../format.ts";
import type { Coupon, DayHours, MenuData, MenuItem, OptionGroup, StoreInfo } from "./types.ts";

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/* ------------------------------------------------------------------ */
/* Endereço (slug)                                                      */
/* ------------------------------------------------------------------ */

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/;

export function slugify(name: string): string {
  const s = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return s.length >= 3 ? s : `${s || "loja"}-${Math.random().toString(36).slice(2, 6)}`;
}

/* ------------------------------------------------------------------ */
/* Cardápio novo e normalização                                         */
/* ------------------------------------------------------------------ */

const DEFAULT_HOURS: DayHours[] = [["18:00", "23:00"], null, ["18:00", "23:00"], ["18:00", "23:00"], ["18:00", "23:00"], ["18:00", "23:30"], ["18:00", "23:30"]];

export function emptyStore(name: string): StoreInfo {
  return {
    name,
    tagline: "",
    headline: name,
    description: "",
    accent: "#de3f1c",
    heroClips: [],
    whatsapp: "",
    address: "",
    city: "",
    hours: DEFAULT_HOURS.map((h) => (h ? [h[0], h[1]] : null)),
    delivery: { enabled: true, time: "40–60 min", freeFrom: null, zones: [] },
    pickup: { enabled: true, time: "20–30 min" },
    dineIn: { enabled: false, tables: 10 },
    minOrder: 0,
    payments: { pix: true, card: true, cash: true },
    promos: [],
    acceptWhenClosed: false,
  };
}

/** Cardápio "do zero": só o nome da loja e uma categoria vazia para começar. */
export function emptyMenu(name: string): MenuData {
  return {
    version: 1,
    store: emptyStore(name),
    categories: [{ id: uid("cat"), name: "Lanches", description: "", items: [] }],
    groups: [],
    coupons: [],
  };
}

/** Completa campos ausentes (cardápios salvos por versões anteriores ou dados parciais). */
export function normalizeMenu(raw: unknown, fallbackName = "Minha loja"): MenuData {
  const d = (raw && typeof raw === "object" ? raw : {}) as Partial<MenuData>;
  const base = emptyStore(d.store?.name || fallbackName);
  const s = { ...base, ...(d.store ?? {}) } as StoreInfo;
  s.delivery = { ...base.delivery, ...(d.store?.delivery ?? {}) };
  s.pickup = { ...base.pickup, ...(d.store?.pickup ?? {}) };
  s.payments = { ...base.payments, ...(d.store?.payments ?? {}) };
  s.dineIn = { ...base.dineIn, ...(d.store?.dineIn ?? {}) };
  s.hours = Array.from({ length: 7 }, (_, i) => {
    const h = d.store?.hours?.[i];
    return Array.isArray(h) && h.length === 2 ? [String(h[0]), String(h[1])] : h === null ? null : base.hours[i];
  });
  s.heroClips = Array.isArray(s.heroClips) ? s.heroClips : [];
  s.promos = Array.isArray(s.promos) ? s.promos.filter(Boolean) : [];
  s.delivery.zones = Array.isArray(s.delivery.zones) ? s.delivery.zones : [];
  return {
    version: 1,
    store: s,
    categories: (Array.isArray(d.categories) ? d.categories : []).map((c) => ({
      id: c.id || uid("cat"),
      name: c.name ?? "",
      description: c.description ?? "",
      items: (Array.isArray(c.items) ? c.items : []).map((i) => ({
        ...i,
        id: i.id || uid("item"),
        name: i.name ?? "",
        description: i.description ?? "",
        price: Number(i.price) || 0,
        available: i.available !== false,
        groupIds: Array.isArray(i.groupIds) ? i.groupIds : [],
      })),
    })),
    groups: (Array.isArray(d.groups) ? d.groups : []).map((g) => ({
      ...g,
      label: g.label || g.title,
      options: Array.isArray(g.options) ? g.options : [],
    })),
    coupons: Array.isArray(d.coupons) ? d.coupons : [],
  };
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function allItems(menu: MenuData): (MenuItem & { categoryId: string })[] {
  return menu.categories.flatMap((c) => c.items.map((i) => ({ ...i, categoryId: c.id })));
}

/* ------------------------------------------------------------------ */
/* Horário de funcionamento                                             */
/* ------------------------------------------------------------------ */

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

function inRange(h: DayHours, mins: number): boolean {
  if (!h) return false;
  const a = toMin(h[0]);
  let b = toMin(h[1]);
  if (b <= a) b += 1440;
  return mins >= a && mins < b;
}

export interface OpenStatus {
  open: boolean;
  /** "até 23:30" ou "abre hoje às 18:00" */
  label: string;
}

export function openStatus(hours: DayHours[], now: Date): OpenStatus {
  const day = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  const prev = (day + 6) % 7;
  if (inRange(hours[day], mins)) return { open: true, label: `até ${hours[day]![1]}` };
  if (inRange(hours[prev], mins + 1440)) return { open: true, label: `até ${hours[prev]![1]}` };
  for (let k = 0; k < 8; k++) {
    const d = (day + k) % 7;
    const h = hours[d];
    if (h && (k > 0 || toMin(h[0]) > mins)) {
      const when = k === 0 ? "hoje" : k === 1 ? "amanhã" : WEEKDAYS[d].toLowerCase();
      return { open: false, label: `abre ${when} às ${h[0]}` };
    }
  }
  return { open: false, label: "" };
}

/* ------------------------------------------------------------------ */
/* Pedido                                                               */
/* ------------------------------------------------------------------ */

export interface ChosenOption {
  groupId: string;
  name: string;
  price: number;
}

export interface CartLine {
  key: string;
  itemId: string;
  qty: number;
  opts: ChosenOption[];
  note: string;
  /** preço unitário com adicionais */
  unit: number;
}

export type OrderMode = "delivery" | "pickup" | "table";

export function unitPrice(item: Pick<MenuItem, "price">, opts: ChosenOption[]): number {
  return round2(item.price + opts.reduce((s, o) => s + o.price, 0));
}

export function missingRequired(groups: OptionGroup[], selected: Record<string, number[]>): string | null {
  const g = groups.find((x) => x.required && !(selected[x.id]?.length));
  return g ? g.id : null;
}

/** Mesma escolha (produto + opções + observação) soma na mesma linha. */
export function lineSignature(itemId: string, opts: ChosenOption[], note: string): string {
  return `${itemId}|${opts.map((o) => `${o.groupId}:${o.name}`).join(",")}|${note.trim()}`;
}

export const cartCount = (cart: CartLine[]) => cart.reduce((s, l) => s + l.qty, 0);
export const cartSubtotal = (cart: CartLine[]) => round2(cart.reduce((s, l) => s + l.unit * l.qty, 0));

export function findCoupon(coupons: Coupon[], code: string | null | undefined): Coupon | undefined {
  if (!code) return undefined;
  const c = code.trim().toUpperCase();
  return coupons.find((x) => x.active && x.code.trim().toUpperCase() === c);
}

export function couponDiscount(coupon: Coupon | undefined, subtotal: number): number {
  if (!coupon) return 0;
  return round2(coupon.type === "pct" ? (subtotal * Math.min(100, Math.max(0, coupon.value))) / 100 : Math.min(Math.max(0, coupon.value), subtotal));
}

/** Taxa de entrega: null quando o bairro ainda não foi escolhido. */
export function deliveryFee(store: StoreInfo, mode: OrderMode, zoneId: string | undefined, subtotal: number): number | null {
  if (mode !== "delivery") return 0;
  const z = store.delivery.zones.find((x) => x.id === zoneId);
  if (!z) return store.delivery.zones.length ? null : 0;
  if (store.delivery.freeFrom != null && store.delivery.freeFrom > 0 && subtotal >= store.delivery.freeFrom) return 0;
  return z.fee;
}

export function minZoneFee(store: StoreInfo): number | null {
  if (!store.delivery.zones.length) return null;
  return Math.min(...store.delivery.zones.map((z) => z.fee));
}

export function orderTotal(subtotal: number, discount: number, fee: number | null): number {
  return round2(Math.max(0, subtotal - discount + (fee ?? 0)));
}

export interface Customer {
  name: string;
  phone: string;
  zoneId?: string;
  street?: string;
  number?: string;
  complement?: string;
  cep?: string;
  pay?: "Pix" | "Cartão" | "Dinheiro";
  change?: string;
  /** número da mesa (pedido pelo QR Code da mesa) */
  table?: string;
}

export interface OrderSummary {
  code: string;
  mode: OrderMode;
  customer: Customer;
  lines: CartLine[];
  coupon?: Coupon;
}

/** Valor do troco digitado ("100", "100,00", "R$ 100") ou 0. */
export function parseChange(v: string | undefined): number {
  if (!v) return 0;
  const n = parseFloat(v.replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function buildOrderMessage(menu: MenuData, o: OrderSummary): string {
  const s = menu.store;
  const items = allItems(menu);
  const groups = new Map(menu.groups.map((g) => [g.id, g]));
  const brl = (v: number) => formatBRL(v).replace(/\s/g, " ");
  const sub = cartSubtotal(o.lines);
  const disc = couponDiscount(o.coupon, sub);
  const fee = deliveryFee(s, o.mode, o.customer.zoneId, sub);
  const total = orderTotal(sub, disc, fee);
  const line = "────────────";
  const out: string[] = [];
  out.push(`*Novo pedido #${o.code}* · ${s.name}`, "");
  out.push(`*${o.mode === "delivery" ? "ENTREGA" : o.mode === "table" ? `MESA ${o.customer.table ?? "?"} · CONSUMO NO LOCAL` : "RETIRADA NA LOJA"}*`);
  out.push(`Cliente: ${o.customer.name}`);
  if (o.customer.phone.trim()) out.push(`Telefone: ${o.customer.phone}`);
  if (o.mode === "delivery") {
    out.push(`Endereço: ${o.customer.street}, ${o.customer.number}${o.customer.complement ? ` – ${o.customer.complement}` : ""}`);
    const zone = s.delivery.zones.find((z) => z.id === o.customer.zoneId);
    const parts = [zone ? `Bairro: ${zone.name}` : "", o.customer.cep ? `CEP ${o.customer.cep}` : ""].filter(Boolean);
    if (parts.length) out.push(parts.join(" · "));
  }
  out.push(line, "*ITENS*");
  for (const l of o.lines) {
    const it = items.find((i) => i.id === l.itemId);
    out.push(`*${l.qty}x ${it?.name ?? "Item"}* — ${brl(l.unit * l.qty)}`);
    for (const op of l.opts) {
      const g = groups.get(op.groupId);
      out.push(`   • ${g?.label || g?.title || "Opção"}: ${op.name}${op.price ? ` (+${brl(op.price)})` : ""}`);
    }
    if (l.note.trim()) out.push(`   _Obs.: ${l.note.trim()}_`);
  }
  out.push(line);
  out.push(`Subtotal: ${brl(sub)}`);
  if (disc) out.push(`Desconto (${o.coupon!.code.toUpperCase()}): – ${brl(disc)}`);
  if (o.mode === "delivery") out.push(`Entrega: ${fee ? brl(fee) : "Grátis"}`);
  out.push(`*Total: ${brl(total)}*`, "");
  let pay = `Pagamento: ${o.customer.pay ?? "—"}`;
  if (o.customer.pay === "Dinheiro") {
    const ch = parseChange(o.customer.change);
    pay += ch ? ` (troco para ${brl(ch)})` : " (sem troco)";
  }
  out.push(pay);
  if (o.mode === "delivery") out.push("", `Previsão: ${s.delivery.time}`);
  else if (o.mode === "pickup") out.push("", `Retirada em: ${s.address}${s.city ? ` – ${s.city}` : ""}`);
  return out.join("\n");
}

export function whatsappOrderUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

export function isValidWhatsapp(phone: string): boolean {
  return /^55\d{10,11}$/.test(phone.replace(/\D/g, ""));
}

/* ------------------------------------------------------------------ */
/* Pronto para publicar?                                                */
/* ------------------------------------------------------------------ */

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export function publishChecklist(menu: MenuData): ChecklistItem[] {
  const items = allItems(menu);
  return [
    { id: "whatsapp", label: "WhatsApp que recebe os pedidos", done: isValidWhatsapp(menu.store.whatsapp) },
    { id: "items", label: "Pelo menos um produto com preço", done: items.some((i) => i.available && i.price > 0) },
    { id: "photos", label: "Fotos nos produtos", done: items.length > 0 && items.every((i) => !!i.image) },
    { id: "modes", label: "Entrega ou retirada ativada", done: menu.store.delivery.enabled || menu.store.pickup.enabled },
    { id: "zones", label: "Bairros e taxas de entrega", done: !menu.store.delivery.enabled || menu.store.delivery.zones.length > 0 },
    { id: "address", label: "Endereço da loja", done: !!menu.store.address.trim() },
  ];
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
