"use client";

import { useEffect, useState } from "react";
import {
  LuArrowRight,
  LuBadgePercent,
  LuChevronDown,
  LuClock3,
  LuImage,
  LuLayers,
  LuQrCode,
  LuMapPin,
  LuMenu,
  LuMessageCircle,
  LuMonitorSmartphone,
  LuPackageX,
  LuPalette,
  LuShoppingBag,
  LuStore,
  LuX,
} from "react-icons/lu";
import { whatsappLink } from "@/lib/contact";
import { href } from "@/lib/paths";
import { PricingCalculator } from "../pricing/Pricing";
import { HelpButton } from "../support/HelpCenter";
import { cx, Logo, usePresence } from "../ui";

const DEMO = href("/demo/");
const PANEL = href("/app/");
const HOME = href("/");
const PLANS = href("/planos/");
const LOGIN = href("/empresa/");

function CTA({ children = "Ver cardápio de exemplo", to = DEMO, variant = "dark", className }: { children?: React.ReactNode; to?: string; variant?: "light" | "dark"; className?: string }) {
  return (
    <a
      href={to}
      className={cx(
        "group inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full pl-6 pr-2 text-[15px] font-semibold transition-all active:scale-[0.98]",
        variant === "light" ? "bg-paper text-ink hover:bg-white" : "bg-ink text-paper hover:bg-navy-700",
        className,
      )}
    >
      {children}
      <span className={cx("grid size-8 place-items-center rounded-full transition-transform group-hover:translate-x-0.5", variant === "light" ? "bg-ink text-paper" : "bg-paper text-ink")}>
        <LuArrowRight className="size-4" />
      </span>
    </a>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const menu = usePresence(open, 200);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const links = [
    [`${HOME}#como-funciona`, "Como funciona"],
    [`${HOME}#recursos`, "Recursos"],
    [DEMO, "Exemplo"],
    [PLANS, "Planos"],
    [`${HOME}#perguntas`, "Perguntas"],
  ];
  return (
    <header className={cx("fixed inset-x-0 top-0 z-40 transition-[background-color,border-color] duration-300", scrolled || open ? "border-b border-line/70 bg-paper/95 md:bg-paper/85 md:backdrop-blur-xl" : "border-b border-transparent")}>
      <div className="mx-auto flex h-[72px] max-w-6xl items-center gap-6 px-4 sm:px-6">
        <a href={HOME} aria-label="Luma — início">
          <Logo />
        </a>
        <nav aria-label="Seções" className="ml-6 hidden gap-1 md:flex">
          {links.map(([h, l]) => (
            <a key={h} href={h} className="rounded-full px-3.5 py-2 text-sm font-medium text-ink/65 transition-colors hover:bg-ink/5 hover:text-ink">
              {l}
            </a>
          ))}
        </nav>
        <a href={LOGIN} className="ml-auto hidden h-10 items-center rounded-full px-4 text-sm font-semibold text-ink transition-colors hover:bg-ink/5 sm:inline-flex">
          Entrar
        </a>
        <a href={PANEL} className="hidden h-10 items-center rounded-full bg-ink px-5 text-sm font-semibold text-paper transition-colors hover:bg-navy-700 sm:inline-flex">
          Testar o painel
        </a>
        <button className="relative ml-auto grid size-10 place-items-center rounded-full text-ink transition-transform active:scale-90 md:hidden sm:ml-0" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <LuMenu className={cx("absolute size-6 transition-all duration-300", open ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100")} />
          <LuX className={cx("absolute size-6 transition-all duration-300", open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0")} />
        </button>
      </div>
      {menu.render && (
        <nav data-state={menu.state} className="anim-drop border-t border-line px-4 pb-5 pt-2 [transform-origin:top_center] md:hidden">
          {links.map(([h, l]) => (
            <a key={h} href={h} onClick={() => setOpen(false)} className="block rounded-2xl px-3 py-3 text-base font-medium text-ink hover:bg-ink/5">
              {l}
            </a>
          ))}
          <a href={LOGIN} className="block rounded-2xl px-3 py-3 text-base font-semibold text-ink hover:bg-ink/5">
            Entrar (lojas)
          </a>
          <CTA className="mt-3 w-full" to={PANEL}>
            Testar o painel
          </CTA>
        </nav>
      )}
    </header>
  );
}

/** Celular com o cardápio de exemplo funcionando de verdade dentro. */
function PhoneDemo() {
  const [load, setLoad] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoad(true), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="relative mx-auto w-[300px] max-w-full sm:w-[320px]">
      <div className="relative aspect-[9/19] w-full overflow-hidden rounded-[44px] border-[10px] border-ink bg-ink shadow-[0_50px_100px_-30px_rgba(10,31,24,0.6)]">
        <div className="absolute left-1/2 top-2 z-10 h-6 w-28 -translate-x-1/2 rounded-full bg-ink" />
        {load ? (
          <iframe title="Cardápio de exemplo" src={DEMO} className="size-full rounded-[34px] bg-[#f6f1e8]" loading="lazy" />
        ) : (
          <div className="size-full rounded-[34px] bg-[#f6f1e8]" />
        )}
      </div>
      <p className="mt-4 text-center text-xs text-muted">Toque e teste: o pedido abre no WhatsApp.</p>
    </div>
  );
}

function Hero() {
  return (
    <section className="dot-grid relative overflow-hidden pb-20 pt-32 sm:pb-28 sm:pt-40">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-paper" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.25fr_1fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white/80 py-1.5 pl-1.5 pr-3.5 text-[13px] font-medium text-ink/75 shadow-sm">
            <span className="grid size-6 place-items-center rounded-full bg-[#1f9d55] text-white">
              <LuMessageCircle className="size-3.5" />
            </span>
            Pedido pronto no WhatsApp da loja
          </span>
          <h1 className="mt-6 font-display text-[2.8rem] font-bold leading-[1] tracking-[-0.035em] sm:text-[4.6rem]">
            O cardápio digital que faz o cliente pedir.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/70">
            Fotos e vídeos dos pratos, adicionais, entrega ou retirada e cupom. O cliente monta a sacola em poucos toques e o pedido chega organizado no seu WhatsApp, sem comissão por pedido.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <CTA />
            <a href={PANEL} className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-full border border-ink/15 bg-white/60 px-6 text-[15px] font-semibold text-ink transition-colors hover:border-ink/40">
              Testar o painel da loja
            </a>
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-ink/10 pt-6">
            {[
              ["0%", "de comissão por pedido"],
              ["1 link", "para Instagram, WhatsApp e mesas"],
              ["Na hora", "troca de preço e esgotado"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="font-display text-2xl font-semibold tracking-tight">{v}</dt>
                <dd className="mt-1 text-xs leading-snug text-muted">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
        <PhoneDemo />
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    ["O cliente abre o seu link", "Pelo Instagram, pelo status do WhatsApp ou pelo QR Code da mesa. Vê fotos, vídeos e o que está aberto agora."],
    ["Monta a sacola", "Escolhe ponto da carne, adicionais e observações. Informa entrega ou retirada, bairro, pagamento e troco."],
    ["O pedido chega no seu WhatsApp", "Com itens, adicionais, endereço, taxa, desconto e total já calculados. É só confirmar e preparar."],
  ];
  return (
    <section id="como-funciona" className="scroll-mt-20 bg-navy-900 py-20 text-white sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.08]">Do link ao pedido em três passos</h2>
          <ol className="mt-10 space-y-8">
            {steps.map(([t, d], i) => (
              <li key={t} className="flex gap-5">
                <span className="font-display text-4xl font-semibold text-accent">{i + 1}</span>
                <div>
                  <h3 className="font-display text-xl font-semibold">{t}</h3>
                  <p className="mt-2 max-w-md leading-relaxed text-white/65">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="self-center rounded-[28px] bg-[#0b141a] p-4 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.7)] sm:p-6">
          <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Como chega no WhatsApp</p>
          <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-sm bg-[#005c4b] px-4 py-3 font-mono text-[12.5px] leading-relaxed text-[#e9edef]">
            <p>
              <b>Novo pedido #4821</b> · Brasa Burger
            </p>
            <p className="mt-2">
              <b>ENTREGA</b>
            </p>
            <p>Cliente: Ana · (62) 98888-1234</p>
            <p>Rua 7, 120 – Ap 32 · Setor Oeste</p>
            <p className="mt-2 text-white/50">────────────</p>
            <p>
              <b>2x Brasa Burger</b> — R$ 83,80
            </p>
            <p className="pl-3 text-white/80">• Ponto: Ao ponto</p>
            <p className="pl-3 text-white/80">• Adicional: Bacon (+R$ 5,00)</p>
            <p>
              <b>1x Fritas Rústicas</b> — R$ 18,90
            </p>
            <p className="text-white/50">────────────</p>
            <p>Subtotal: R$ 102,70</p>
            <p>Desconto (BEMVINDO10): – R$ 10,27</p>
            <p>Entrega: Grátis</p>
            <p>
              <b>Total: R$ 92,43</b>
            </p>
            <p className="mt-2">Pagamento: Pix</p>
          </div>
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  [LuImage, "Fotos e vídeos que dão fome", "Capa com vídeos curtos do preparo passando como stories, e foto em cada produto."],
  [LuLayers, "Adicionais e escolhas", "Ponto da carne, tamanho, sabor e extras pagos, com opções obrigatórias e limite de escolhas."],
  [LuMapPin, "Entrega por bairro", "Cada bairro com sua taxa, frete grátis acima de um valor e preenchimento pelo CEP."],
  [LuStore, "Retirada no balcão", "O cliente escolhe entre entrega e retirada, cada um com o seu tempo de preparo."],
  [LuBadgePercent, "Cupons de desconto", "Porcentagem ou valor fixo, ativados e desativados quando quiser."],
  [LuClock3, "Aberto e fechado sozinho", "O cardápio mostra o horário de hoje e avisa quando a loja abre."],
  [LuPackageX, "Esgotado com um toque", "Acabou o pão? Marque o produto como esgotado e ele para de ser vendido na hora."],
  [LuPalette, "Com a cara da sua loja", "Seu logo, sua cor, seus textos. Nada de visual genérico de aplicativo."],
  [LuQrCode, "QR Code no balcão e na mesa", "Cada mesa com o seu QR Code: o cliente pede pelo celular e o pedido chega com o número da mesa."],
] as const;

function Features() {
  return (
    <section id="recursos" className="scroll-mt-20 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.08]">Tudo o que um cardápio precisa para vender mais</h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">Feito para hamburguerias, pizzarias, lanchonetes, açaí, marmitas, doceiras e restaurantes que vendem pelo WhatsApp.</p>
        </div>
        <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([Icon, t, d]) => (
            <div key={t} className="border-t-2 border-ink pt-5">
              <Icon className="size-6" />
              <h3 className="mt-3 font-display text-lg font-semibold">{t}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PanelSection() {
  return (
    <section className="bg-paper py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.08]">Você muda o cardápio em segundos, pelo celular</h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">Preço, foto, produto novo, bairro, horário. Salvou, está no ar. Sem pedir para ninguém e sem esperar.</p>
          <ul className="mt-8 space-y-3 text-[15px]">
            {["Painel em português, simples para quem atende no balcão", "Prévia do cardápio antes de publicar", "Modelo pronto de hamburgueria para começar rápido", "Equipe com acesso: administrador, editor e somente consulta"].map((t) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-ink" />
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <CTA to={PANEL}>Testar o painel</CTA>
          </div>
        </div>
        <div className="dot-grid-light relative overflow-hidden rounded-[32px] bg-ink p-6 text-paper shadow-[var(--shadow-pop)] sm:p-8">
          <div className="flex items-center gap-2 text-sm">
            <span className="size-2.5 rounded-full bg-[#6fd3a0]" /> Cardápio no ar
          </div>
          <p className="mt-3 font-display text-xl font-semibold">gestãoluma.com.br/c/?l=sua-loja</p>
          <div className="mt-6 space-y-2">
            {[
              ["Smash Bacon Duplo", "R$ 34,90", true],
              ["Brasa Burger", "R$ 36,90", true],
              ["Milkshake Nutella", "R$ 22,90", false],
            ].map(([n, p, on]) => (
              <div key={String(n)} className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3">
                <LuShoppingBag className="size-4 text-paper/50" />
                <span className="flex-1 text-sm font-semibold">{n}</span>
                <span className="text-sm tabular text-paper/70">{p}</span>
                <span className={cx("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", on ? "bg-[#6fd3a0]/15 text-[#6fd3a0]" : "bg-white/10 text-paper/60")}>{on ? "Vendendo" : "Esgotado"}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-paper p-3 text-ink">
            <LuMonitorSmartphone className="size-5" />
            <span className="text-sm font-semibold">Funciona no celular e no computador, sem instalar nada.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  ["Quanto custa?", "No mensal, R$ 119,90 por mês por loja + implantação de R$ 197, paga uma vez (a gente monta o cardápio, ajusta as fotos e entrega os QR Codes das mesas). No anual, R$ 1.199 à vista, com 2 meses grátis e implantação grátis. Sem comissão sobre os pedidos e sem fidelidade no mensal."],
  ["Vocês cobram taxa por pedido?", "Não. Os pedidos vão direto para o WhatsApp da loja e o pagamento é feito com a loja, por Pix, cartão ou dinheiro. Você paga só a mensalidade."],
  ["Preciso montar o cardápio sozinho?", "Não. A implantação inclui a montagem: você manda os produtos, preços e fotos, e a Luma entrega o cardápio pronto, com os QR Codes das mesas. Depois você altera o que quiser pelo painel."],
  ["E se eu tiver algum problema?", "É só chamar no WhatsApp. Esqueceu a senha, não está conseguindo trocar uma foto ou precisa de ajuda com o cardápio? A gente resolve com você."],
  ["Como o cliente paga?", "Direto com a loja. O cardápio registra a forma escolhida (Pix, cartão na entrega ou dinheiro com troco) na mensagem do pedido."],
  ["O cliente precisa baixar aplicativo ou fazer cadastro?", "Não. Ele abre o link no navegador, monta o pedido e envia pelo WhatsApp que já tem no celular."],
  ["Posso usar o meu domínio?", "O cardápio fica em um endereço da Luma com o nome da sua loja. Fale com a gente se quiser usar um domínio próprio."],
  ["Serve para pedido na mesa?", "Sim. No painel você imprime um QR Code para cada mesa. O cliente escaneia, pede pelo celular e o pedido chega no WhatsApp da loja com o número da mesa, sem endereço nem taxa de entrega."],
  ["Posso testar antes?", "Sim. O cardápio de exemplo e o painel de demonstração são públicos e não pedem cadastro."],
];

export function PlansSection({ standalone = false }: { standalone?: boolean }) {
  return (
    <section id="planos" className={cx("scroll-mt-20 bg-paper", standalone ? "pb-20 pt-32 sm:pb-28 sm:pt-40" : "py-20 sm:py-28")}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 max-w-2xl">
          {standalone ? (
            <h1 className="font-display text-[2.6rem] font-bold leading-[1.02] tracking-[-0.035em] sm:text-[4rem]">Um plano, um preço, sem comissão</h1>
          ) : (
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.08]">Um plano, um preço, sem comissão</h2>
          )}
          <p className="mt-4 text-lg leading-relaxed text-muted">R$ 119,90 por mês por loja, com tudo incluído, ou o anual com 2 meses grátis. A gente monta o seu cardápio e os pedidos são todos seus.</p>
        </div>
        <PricingCalculator />
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="perguntas" className="scroll-mt-20 bg-white py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.08]">Perguntas frequentes</h2>
          <p className="mt-4 text-muted">Preço, pedidos, pagamento e como começar.</p>
        </div>
        <div className="divide-y divide-line rounded-2xl border border-line bg-white">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-5 py-1 sm:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                {q}
                <LuChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-5 leading-relaxed text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-paper py-20">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">Seu cardápio no ar ainda esta semana</h2>
          <p className="mt-2 max-w-xl text-muted">Veja o exemplo funcionando, teste o painel e fale com a gente para montar o cardápio da sua loja.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <CTA />
          <a href={PLANS} className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-full border border-ink/15 px-6 text-[15px] font-semibold text-ink transition-colors hover:border-ink/40">
            Ver planos
          </a>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="bg-navy-950 py-12 text-white/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-3 text-sm">Cardápio digital com pedido no WhatsApp.</p>
          <p className="mt-4 max-w-sm text-xs leading-relaxed text-white/45">O cardápio de exemplo usa uma loja fictícia; o pedido de teste abre o WhatsApp de um número fictício.</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Produto</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><a className="hover:text-white" href={`${HOME}#recursos`}>Recursos</a></li>
            <li><a className="hover:text-white" href={DEMO}>Cardápio de exemplo</a></li>
            <li><a className="hover:text-white" href={PANEL}>Painel de demonstração</a></li>
            <li><a className="hover:text-white" href={PLANS}>Planos</a></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Ajuda</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><a className="hover:text-white" href={`${HOME}#como-funciona`}>Como funciona</a></li>
            <li><a className="hover:text-white" href={`${HOME}#perguntas`}>Perguntas frequentes</a></li>
            <li><a className="hover:text-white" href={LOGIN}>Entrar (lojas)</a></li>
            {whatsappLink() && (
              <li><a className="hover:text-white" href={whatsappLink()!} target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a></li>
            )}
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 px-4 pb-16 pt-6 text-xs text-white/40 sm:px-6">
        <span>© {new Date().getFullYear()} Luma.</span>
        <a href={href("/termos/")} className="transition-colors hover:text-white/80">
          Termos de uso
        </a>
        <a href={href("/privacidade/")} className="transition-colors hover:text-white/80">
          Privacidade
        </a>
        <a href={href("/admin/")} className="text-white/25 transition-colors hover:text-white/60" rel="nofollow">
          Acesso restrito
        </a>
      </div>
      <div className="fixed bottom-5 right-5 z-40 print:hidden">
        <HelpButton variant="pill" />
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <PanelSection />
        <PlansSection />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
