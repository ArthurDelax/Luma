import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildOrderMessage,
  cartSubtotal,
  couponDiscount,
  deliveryFee,
  emptyMenu,
  findCoupon,
  isValidWhatsapp,
  lineSignature,
  missingRequired,
  normalizeMenu,
  openStatus,
  orderTotal,
  parseChange,
  publishChecklist,
  slugify,
  SLUG_RE,
  unitPrice,
  type CartLine,
} from "../src/lib/menu/logic.ts";
import { sampleMenu } from "../src/lib/menu/sample.ts";

const menu = sampleMenu();
const store = menu.store;

test("endereço do cardápio a partir do nome", () => {
  assert.equal(slugify("Brasa Burger & Co."), "brasa-burger-e-co");
  assert.equal(slugify("  Pão de Açúcar Lanches!! "), "pao-de-acucar-lanches");
  assert.match(slugify("X"), SLUG_RE);
  assert.ok(SLUG_RE.test(slugify("a".repeat(80))));
  assert.equal(SLUG_RE.test("Com Espaço"), false);
  assert.equal(SLUG_RE.test("-comeca-com-hifen"), false);
});

test("preço com adicionais e linha da sacola", () => {
  const opts = [
    { groupId: "ponto", name: "Ao ponto", price: 0 },
    { groupId: "extras", name: "Bacon crocante", price: 5 },
  ];
  assert.equal(unitPrice({ price: 36.9 }, opts), 41.9);
  assert.equal(lineSignature("a1", opts, " sem cebola "), "a1|ponto:Ao ponto,extras:Bacon crocante|sem cebola");
  const cart: CartLine[] = [
    { key: "1", itemId: "a1", qty: 2, opts, note: "", unit: 41.9 },
    { key: "2", itemId: "f1", qty: 1, opts: [], note: "", unit: 18.9 },
  ];
  assert.equal(cartSubtotal(cart), 102.7);
});

test("opção obrigatória sem escolha bloqueia o produto", () => {
  const groups = menu.groups.filter((g) => ["ponto", "pao", "extras"].includes(g.id));
  assert.equal(missingRequired(groups, { ponto: [], pao: [0], extras: [] }), "ponto");
  assert.equal(missingRequired(groups, { ponto: [1], pao: [0], extras: [] }), null);
});

test("cupons: porcentagem, valor fixo, inativo e maiúsculas", () => {
  assert.equal(couponDiscount(findCoupon(menu.coupons, "bemvindo10"), 102.7), 10.27);
  assert.equal(couponDiscount(findCoupon(menu.coupons, "BRASA5"), 3), 3); // nunca maior que o pedido
  assert.equal(findCoupon([{ code: "OFF", type: "pct", value: 50, active: false }], "OFF"), undefined);
  assert.equal(findCoupon(menu.coupons, ""), undefined);
});

test("taxa de entrega por bairro e frete grátis", () => {
  assert.equal(deliveryFee(store, "delivery", undefined, 50), null);
  assert.equal(deliveryFee(store, "delivery", "z6", 50), 9);
  assert.equal(deliveryFee(store, "delivery", "z6", 99), 0);
  assert.equal(deliveryFee(store, "pickup", undefined, 10), 0);
  assert.equal(deliveryFee({ ...store, delivery: { ...store.delivery, zones: [] } }, "delivery", undefined, 10), 0);
  assert.equal(orderTotal(102.7, 10.27, 0), 92.43);
  assert.equal(orderTotal(10, 20, null), 0);
});

test("aberto, fechado e horário depois da meia-noite", () => {
  const hours = store.hours; // sábado 12:00–00:30, segunda fechado
  // sábado 23:50 → aberto
  assert.deepEqual(openStatus(hours, new Date(2026, 9, 24, 23, 50)), { open: true, label: "até 00:30" });
  // domingo 00:10 → ainda é o expediente de sábado
  assert.equal(openStatus(hours, new Date(2026, 9, 25, 0, 10)).open, true);
  // domingo 10:00 → abre hoje às 18:00
  assert.deepEqual(openStatus(hours, new Date(2026, 9, 25, 10, 0)), { open: false, label: "abre hoje às 18:00" });
  // segunda 12:00 (fechado) → abre amanhã
  assert.deepEqual(openStatus(hours, new Date(2026, 9, 26, 12, 0)), { open: false, label: "abre amanhã às 18:00" });
});

test("troco digitado de vários jeitos", () => {
  assert.equal(parseChange("100"), 100);
  assert.equal(parseChange("R$ 150,00"), 150);
  assert.equal(parseChange("1.000,50"), 1000.5);
  assert.equal(parseChange(""), 0);
});

test("mensagem do pedido para o WhatsApp", () => {
  const lines: CartLine[] = [
    { key: "1", itemId: "a1", qty: 2, opts: [{ groupId: "ponto", name: "Ao ponto", price: 0 }, { groupId: "extras", name: "Bacon crocante", price: 5 }], note: "sem cebola", unit: 41.9 },
    { key: "2", itemId: "f2", qty: 1, opts: [], note: "", unit: 24.9 },
  ];
  const msg = buildOrderMessage(menu, {
    code: "1234",
    mode: "delivery",
    customer: { name: "Carlos", phone: "(11) 98765-4321", zoneId: "z6", street: "Rua dos Pinheiros", number: "300", complement: "Apto 12", pay: "Dinheiro", change: "150" },
    lines,
    coupon: findCoupon(menu.coupons, "BEMVINDO10"),
  });
  assert.match(msg, /^\*Novo pedido #1234\* · Brasa Burger & Co\./);
  assert.match(msg, /Endereço: Rua dos Pinheiros, 300 – Apto 12/);
  assert.match(msg, /Bairro: Pinheiros/);
  assert.match(msg, /\*2x Brasa Burger\* — R\$ 83,80/);
  assert.match(msg, /• Ponto: Ao ponto/);
  assert.match(msg, /• Adicional: Bacon crocante \(\+R\$ 5,00\)/);
  assert.match(msg, /_Obs\.: sem cebola_/);
  assert.match(msg, /Desconto \(BEMVINDO10\): – R\$ 10,87/);
  assert.match(msg, /Entrega: Grátis/); // 108,70 passa do frete grátis (99)
  assert.match(msg, /\*Total: R\$ 97,83\*/);
  assert.match(msg, /Pagamento: Dinheiro \(troco para R\$ 150,00\)/);

  const pickup = buildOrderMessage(menu, { code: "9", mode: "pickup", customer: { name: "Ana", phone: "1", pay: "Pix" }, lines: [lines[1]] });
  assert.match(pickup, /RETIRADA NA LOJA/);
  assert.doesNotMatch(pickup, /Entrega:/);
  assert.match(pickup, /Retirada em: Rua Augusta, 1520/);
});

test("WhatsApp da loja e checklist para publicar", () => {
  assert.equal(isValidWhatsapp("5562993047680"), true);
  assert.equal(isValidWhatsapp("62993047680"), false);
  const empty = emptyMenu("Minha Loja");
  const pending = publishChecklist(empty).filter((c) => !c.done).map((c) => c.id);
  assert.deepEqual(pending.sort(), ["address", "items", "photos", "whatsapp", "zones"].sort());
  assert.ok(publishChecklist(menu).every((c) => c.done));
});

test("cardápio salvo incompleto é completado", () => {
  const n = normalizeMenu({ store: { name: "Loja X", hours: [null] }, categories: [{ name: "Lanches", items: [{ name: "X", price: "12.5" }] }] });
  assert.equal(n.store.name, "Loja X");
  assert.equal(n.store.hours.length, 7);
  assert.equal(n.store.hours[0], null);
  assert.equal(n.categories[0].items[0].price, 12.5);
  assert.equal(n.categories[0].items[0].available, true);
  assert.ok(n.categories[0].id && n.categories[0].items[0].id);
  assert.deepEqual(n.groups, []);
});
