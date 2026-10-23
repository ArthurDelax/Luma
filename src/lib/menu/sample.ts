/**
 * Loja de demonstração (Brasa Burger & Co.): usada no cardápio de exemplo,
 * no painel de demonstração e como modelo para começar uma loja de hamburgueria.
 * Fotos (Unsplash) e vídeos (Mixkit) de uso gratuito, em public/demo.
 */

import type { MenuData, OptionGroup } from "./types.ts";

export function sampleMenu(base = ""): MenuData {
  const img = (id: string) => `${base}/demo/img/${id}.jpg`;
  const vid = (id: number) => `${base}/demo/video/${id}.mp4`;

  const groups: OptionGroup[] = [
    { id: "ponto", title: "Ponto da carne", label: "Ponto", type: "single", required: true, options: [{ name: "Mal passado", price: 0 }, { name: "Ao ponto", price: 0 }, { name: "Bem passado", price: 0 }] },
    { id: "pao", title: "Escolha o pão", label: "Pão", type: "single", required: true, options: [{ name: "Brioche", price: 0 }, { name: "Australiano", price: 0 }, { name: "Sem glúten", price: 4 }] },
    {
      id: "extras",
      title: "Turbine seu burger",
      label: "Adicional",
      type: "multi",
      required: false,
      max: 4,
      options: [{ name: "Bacon crocante", price: 5 }, { name: "Cheddar extra", price: 4 }, { name: "Carne extra", price: 9 }, { name: "Ovo caipira", price: 3 }, { name: "Cebola caramelizada", price: 4 }, { name: "Jalapeño", price: 3 }],
    },
    { id: "molhos", title: "Molhos extras", label: "Molho", type: "multi", required: false, max: 3, options: [{ name: "Maionese da casa", price: 2 }, { name: "Barbecue defumado", price: 2 }, { name: "Cheddar cremoso", price: 4 }, { name: "Maionese de alho", price: 2 }] },
    { id: "bebida", title: "Escolha a bebida", label: "Bebida", type: "single", required: true, options: [{ name: "Coca-Cola lata", price: 0 }, { name: "Coca-Cola Zero lata", price: 0 }, { name: "Guaraná Antarctica lata", price: 0 }, { name: "Água com gás", price: 0 }] },
    { id: "refri", title: "Sabor", label: "Sabor", type: "single", required: true, options: [{ name: "Coca-Cola", price: 0 }, { name: "Coca-Cola Zero", price: 0 }, { name: "Guaraná Antarctica", price: 0 }, { name: "Sprite", price: 0 }] },
    { id: "shake", title: "Sabor do milkshake", label: "Sabor", type: "single", required: true, options: [{ name: "Ovomaltine", price: 0 }, { name: "Doce de leite", price: 0 }, { name: "Morango", price: 0 }, { name: "Nutella", price: 3 }] },
    { id: "tam", title: "Tamanho", label: "Tamanho", type: "single", required: true, options: [{ name: "300 ml", price: 0 }, { name: "500 ml", price: 6 }] },
  ];

  return {
    version: 1,
    store: {
      name: "Brasa Burger & Co.",
      tagline: "Smash & artesanal · desde 2016",
      headline: "Feito na brasa, montado na hora.",
      description: "Blend próprio moído todo dia, pão brioche da casa e molhos autorais. Peça em poucos toques e receba no WhatsApp.",
      accent: "#de3f1c",
      coverUrl: img("hero"),
      heroClips: [
        { url: vid(16599), start: 1, len: 6, label: "Temperado na hora" },
        { url: vid(46660), start: 2, len: 6, label: "Direto na brasa" },
        { url: vid(12041), start: 4, len: 6, label: "Selado no ponto" },
        { url: vid(12016), start: 3, len: 7, label: "Queijo derretendo" },
      ],
      whatsapp: "5511999999999",
      address: "Rua Augusta, 1520 – Consolação",
      city: "São Paulo – SP",
      instagram: "brasaburger.co",
      hours: [["18:00", "23:30"], null, ["18:00", "23:30"], ["18:00", "23:30"], ["18:00", "23:30"], ["18:00", "00:30"], ["12:00", "00:30"]],
      delivery: {
        enabled: true,
        time: "35–50 min",
        freeFrom: 99,
        zones: [
          { id: "z1", name: "Consolação", fee: 5 },
          { id: "z2", name: "Bela Vista", fee: 6 },
          { id: "z3", name: "Jardins", fee: 7 },
          { id: "z4", name: "Higienópolis", fee: 7 },
          { id: "z5", name: "Liberdade", fee: 8 },
          { id: "z6", name: "Pinheiros", fee: 9 },
          { id: "z7", name: "Vila Mariana", fee: 10 },
        ],
      },
      pickup: { enabled: true, time: "15–20 min" },
      minOrder: 25,
      payments: { pix: true, card: true, cash: true },
      promos: ["Use o cupom BEMVINDO10 e ganhe 10% off", "Terça do Smash: 2º burger com 50%", "Frete grátis acima de R$ 99 em bairros próximos", "Batata rústica feita na hora"],
      acceptWhenClosed: true,
      rating: { value: 4.9, count: 1284 },
    },
    groups,
    coupons: [
      { code: "BEMVINDO10", type: "pct", value: 10, active: true },
      { code: "BRASA5", type: "fix", value: 5, active: true },
    ],
    categories: [
      {
        id: "smash",
        name: "Smash Burgers",
        description: "Prensados na chapa bem quente, bordas crocantes.",
        items: [
          { id: "s1", name: "Smash Clássico", description: "Pão brioche, 2 smash de 80g, cheddar inglês, picles e molho da casa.", price: 28.9, image: img("1568901346375-23c9450c58cd"), tag: "Mais pedido", available: true, groupIds: ["pao", "extras"] },
          { id: "s2", name: "Smash Bacon Duplo", description: "2 smash de 90g, cheddar duplo, bacon crocante e cebola caramelizada.", price: 34.9, image: img("1553979459-d2229ba7433b"), available: true, featured: true, groupIds: ["pao", "extras"] },
          { id: "s3", name: "Triple Smash", description: "3 carnes, 3 fatias de cheddar, cebola roxa e maionese defumada.", price: 39.9, oldPrice: 44.9, image: img("1586190848861-99aa4a171e90"), available: true, groupIds: ["pao", "extras"] },
        ],
      },
      {
        id: "art",
        name: "Artesanais",
        description: "Blend de 180g grelhado no ponto que você escolher.",
        items: [
          { id: "a1", name: "Brasa Burger", description: "Blend de costela 180g, queijo prato, alface americana, tomate e maionese verde.", price: 36.9, image: img("1550547660-d9450f859349"), tag: "Assinatura", available: true, featured: true, groupIds: ["ponto", "pao", "extras"] },
          { id: "a2", name: "Gorgonzola & Mel", description: "Blend 180g, gorgonzola cremoso, rúcula fresca e mel trufado.", price: 42.9, image: img("1594212699903-ec8a3eca50f5"), available: true, groupIds: ["ponto", "pao", "extras"] },
          { id: "a3", name: "Cheddar Onion", description: "Blend 180g, cheddar cremoso, onion rings e barbecue defumado.", price: 39.9, image: img("1571091718767-18b5b1457add"), available: true, groupIds: ["ponto", "pao", "extras"] },
          { id: "a4", name: "Veggie da Horta", description: "Burger de grão-de-bico e cogumelos, queijo coalho, tomate e pesto.", price: 34.9, image: img("1525059696034-4967a8e1dca2"), veg: true, available: true, groupIds: ["pao", "molhos"] },
        ],
      },
      {
        id: "sand",
        name: "Sanduíches",
        description: "Clássicos de balcão, no pão certo.",
        items: [
          { id: "d1", name: "Club Sandwich", description: "Pão de forma tostado, peito de peru, bacon, ovo, queijo, alface e tomate.", price: 29.9, image: img("1528735602780-2552fd46c7af"), available: true, groupIds: ["molhos"] },
          { id: "d2", name: "Crispy Chicken", description: "Sobrecoxa empanada crocante, coleslaw, picles e maionese de pimenta.", price: 32.9, image: img("1606755962773-d324e0a13086"), tag: "Novo", available: true, featured: true, groupIds: ["molhos"] },
          { id: "d3", name: "Pastrami NY", description: "Pão de centeio, 150g de pastrami da casa, mostarda dijon e queijo suíço.", price: 44.9, image: img("1553909489-cd47e0907980"), available: true, groupIds: ["molhos"] },
        ],
      },
      {
        id: "combo",
        name: "Combos",
        description: "Burger + fritas + bebida. Sai mais em conta.",
        items: [
          { id: "c1", name: "Combo Smash", description: "Smash Clássico + fritas rústicas média + bebida lata.", price: 42.9, oldPrice: 50.8, image: img("1572802419224-296b0aeee0d9"), tag: "Economize", available: true, featured: true, groupIds: ["bebida", "extras"] },
          { id: "c2", name: "Combo Brasa", description: "Brasa Burger + fritas rústicas média + bebida lata.", price: 49.9, oldPrice: 58.8, image: img("1607013251379-e6eecfffe234"), available: true, groupIds: ["ponto", "bebida", "extras"] },
        ],
      },
      {
        id: "acomp",
        name: "Acompanhamentos",
        description: "Pra dividir (ou não).",
        items: [
          { id: "f1", name: "Fritas Rústicas", description: "300g de batata com casca, alecrim, páprica e flor de sal.", price: 18.9, image: img("1573080496219-bb080dd4f877"), veg: true, available: true, groupIds: ["molhos"] },
          { id: "f2", name: "Fritas Cheddar & Bacon", description: "Fritas rústicas cobertas com cheddar cremoso e farofa de bacon.", price: 24.9, image: img("1630384060421-cb20d0e0649d"), available: true, groupIds: [] },
          { id: "f3", name: "Onion Rings", description: "Anéis de cebola empanados na cerveja, com maionese de alho.", price: 19.9, image: img("1639024471283-03518883512d"), veg: true, available: true, groupIds: ["molhos"] },
        ],
      },
      {
        id: "beb",
        name: "Bebidas",
        description: "Geladas.",
        items: [
          { id: "b1", name: "Refrigerante lata", description: "350 ml.", price: 7, image: img("1622483767028-3f66f32aef97"), available: true, groupIds: ["refri"] },
          { id: "b2", name: "Limonada Suíça", description: "Limão tahiti batido com leite condensado e gelo. 500 ml.", price: 12.9, image: img("1621263764928-df1444c5e859"), available: true, groupIds: [] },
          { id: "b3", name: "Milkshake", description: "Sorvete artesanal batido na hora, com chantilly.", price: 19.9, image: img("1572490122747-3968b75cc699"), available: true, groupIds: ["shake", "tam"] },
        ],
      },
      {
        id: "doce",
        name: "Sobremesas",
        description: "Pra fechar bem.",
        items: [{ id: "e1", name: "Brownie com Sorvete", description: "Brownie de chocolate meio amargo, quentinho, com bola de creme.", price: 16.9, image: img("1606313564200-e75d5e30476c"), available: true, groupIds: [] }],
      },
    ],
  };
}
