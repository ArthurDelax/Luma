"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { LuArrowRight, LuArrowUpRight, LuMenu, LuMinus, LuPlus, LuX } from "react-icons/lu";
import { whatsappLink } from "@/lib/contact";
import { href } from "@/lib/paths";
import { PricingCalculator } from "../pricing/Pricing";
import { HelpButton } from "../support/HelpCenter";
import { cx, LogoMark, usePresence } from "../ui";

// Fontes do site (padrão luxo), servidas pelo próprio site: Playfair Display nos títulos, Montserrat no texto.
import "@fontsource-variable/playfair-display/wght.css";
import "@fontsource-variable/playfair-display/wght-italic.css";
import "@fontsource-variable/montserrat/wght.css";

const DEMO = href("/demo/");
const PANEL = href("/app/");
const HOME = href("/");
const PLANS = href("/planos/");
const LOGIN = href("/empresa/");
const LUX = (f: string) => href(`/lux/${f}`);

/* ------------------------------------------------------------------ */
/* Peças                                                                */
/* ------------------------------------------------------------------ */

/** Botão do site: champanhe (principal) ou contorno (secundário). */
function CTA({ children = "Ver cardápio de exemplo", to = DEMO, variant = "solid", className }: { children?: React.ReactNode; to?: string; variant?: "solid" | "line"; className?: string }) {
  return (
    <a
      href={to}
      className={cx(
        "group inline-flex h-[52px] items-center justify-center gap-3 whitespace-nowrap rounded-full px-7 font-lux-sans text-[11.5px] font-semibold uppercase tracking-[0.2em] transition-colors duration-300",
        variant === "solid" ? "bg-champagne text-noir hover:bg-champagne-2" : "border border-ivory/30 text-ivory hover:border-ivory hover:bg-ivory/5",
        className,
      )}
    >
      {children}
      <LuArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
    </a>
  );
}

function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cx("font-lux-sans text-[11px] font-semibold uppercase tracking-[0.32em] text-champagne", className)}>{children}</p>;
}

function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <LogoMark tone="light" className="size-7" />
      <span className="font-lux-serif text-[1.7rem] font-bold leading-none tracking-[0.02em] text-ivory">Luma</span>
    </span>
  );
}

/** Detalhes do logo no fundo preto: brilhos espalhados e o símbolo em traço fino dourado, grande, entrando pela borda. */
function Ornament({ side = "right" }: { side?: "left" | "right" }) {
  const right = side === "right";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className={cx("absolute top-[-10%] h-[80%] w-[80%] bg-[radial-gradient(closest-side,rgb(207_178_122/0.10),transparent)]", right ? "right-[-25%]" : "left-[-25%]")} />
      <div className="lux-stars absolute inset-0 opacity-80" />
      <svg viewBox="8 8 336 356" fill="none" className={cx("absolute top-1/2 w-[520px] -translate-y-1/2 opacity-[0.09] sm:w-[780px]", right ? "right-[-200px] sm:right-[-220px]" : "left-[-200px] sm:left-[-220px] -scale-x-100")}>
        <path d="M114.6 310.7L34 342L71.8 281.8A148.5 148.5 0 1 1 114.6 310.7Z" stroke="#cfb27a" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M159.2 105.8A77 77 0 1 0 246.2 192.8A62.5 62.5 0 0 1 159.2 105.8Z" stroke="#cfb27a" strokeWidth="1.2" />
        <path d="M231 81.5Q238 113 269.5 120Q238 127 231 158.5Q224 127 192.5 120Q224 113 231 81.5Z" fill="#cfb27a" />
      </svg>
    </div>
  );
}

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Progresso (0 a 1) de uma seção alta enquanto ela passa presa na tela.
 * Só calcula enquanto a seção está à vista; suaviza para acompanhar o dedo sem tremer.
 */
function useScrollProgress(ref: RefObject<HTMLElement | null>, onFrame: (p: number) => void, smooth = 0.14) {
  const cb = useRef(onFrame);
  cb.current = onFrame;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let cur = -1;
    let visible = false;
    const read = () => {
      const r = el.getBoundingClientRect();
      const total = Math.max(1, r.height - window.innerHeight);
      return Math.min(1, Math.max(0, -r.top / total));
    };
    const tick = () => {
      const target = read();
      cur = cur < 0 ? target : cur + (target - cur) * smooth;
      if (Math.abs(target - cur) < 0.0004) cur = target;
      cb.current(cur);
      raf = visible ? requestAnimationFrame(tick) : 0;
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    cb.current(read());
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [ref, smooth]);
}

/** Vídeo de fundo em loop que só toca enquanto aparece na tela. */
function LoopVideo({ name, className, active = true }: { name: string; className?: string; active?: boolean }) {
  const v = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = v.current;
    if (!el) return;
    if (reduceMotion()) return;
    let inView = false;
    const sync = () => (inView && active ? el.play().catch(() => {}) : el.pause());
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      sync();
    });
    io.observe(el);
    sync();
    return () => io.disconnect();
  }, [active]);
  return <video ref={v} className={cx("size-full object-cover", className)} src={LUX(`${name}.mp4`)} poster={LUX(`${name}.jpg`)} muted loop playsInline preload="metadata" aria-hidden />;
}

/* ------------------------------------------------------------------ */
/* Topo                                                                 */
/* ------------------------------------------------------------------ */

export function Header({ overlay = false }: { overlay?: boolean }) {
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
  const solid = !overlay || scrolled || open;
  return (
    <header className={cx("fixed inset-x-0 top-0 z-40 font-lux-sans transition-[background-color,border-color] duration-500", solid ? "border-b border-ivory/10 bg-noir/85 backdrop-blur-xl" : "border-b border-transparent")}>
      <div className="mx-auto flex h-[76px] max-w-7xl items-center gap-6 px-5 sm:px-8">
        <a href={HOME} aria-label="Luma — início">
          <Wordmark />
        </a>
        <nav aria-label="Seções" className="ml-8 hidden gap-7 lg:flex">
          {links.map(([h, l]) => (
            <a key={h} href={h} className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ivory/90 transition-colors duration-300 hover:text-ivory">
              {l}
            </a>
          ))}
        </nav>
        <a href={LOGIN} className="ml-auto hidden text-[11px] font-semibold uppercase tracking-[0.22em] text-ivory/90 transition-colors hover:text-ivory sm:inline">
          Entrar
        </a>
        <a href={PANEL} className="hidden h-10 items-center rounded-full border border-champagne/60 px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-champagne transition-colors duration-300 hover:bg-champagne hover:text-noir sm:inline-flex">
          Testar o painel
        </a>
        <button className="relative ml-auto grid size-11 place-items-center rounded-full text-ivory sm:ml-0 lg:hidden" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <LuMenu className={cx("absolute size-6 transition-all duration-300", open ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100")} />
          <LuX className={cx("absolute size-6 transition-all duration-300", open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0")} />
        </button>
      </div>
      {menu.render && (
        <nav data-state={menu.state} className="anim-drop border-t border-ivory/10 px-5 pb-6 pt-3 [transform-origin:top_center] lg:hidden">
          {links.map(([h, l]) => (
            <a key={h} href={h} onClick={() => setOpen(false)} className="block border-b border-ivory/[0.07] py-4 font-lux-serif font-bold text-2xl text-ivory">
              {l}
            </a>
          ))}
          <a href={LOGIN} className="block py-4 font-lux-serif font-bold text-2xl text-ivory/90">
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

/* ------------------------------------------------------------------ */
/* 1. Abertura: o vídeo avança junto com a rolagem                      */
/* ------------------------------------------------------------------ */

const OPENING = [
  { kicker: "Cardápio digital · Pedido no WhatsApp", title: <>O cardápio à altura <em className="text-champagne">da sua cozinha.</em></>, text: "" },
  { kicker: "Feito para dar fome", title: <>Fotos, vídeos e <em className="text-champagne">desejo</em> em cada prato.</>, text: "Adicionais, entrega ou retirada, cupons e QR Code na mesa. Tudo com a cara da sua casa." },
  { kicker: "Direto para você", title: <>O pedido chega pronto <em className="text-champagne">no seu WhatsApp.</em></>, text: "Sem comissão por pedido. Sem aplicativo para o cliente baixar. Sem intermediário." },
];

function Opening() {
  const wrap = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const lines = useRef<(HTMLDivElement | null)[]>([]);
  const bar = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const r = reduceMotion();
    setStill(r);
    v.src = LUX(window.innerWidth < 768 ? "fogo-rolagem-cel.mp4" : "fogo-rolagem.mp4");
    if (r) {
      v.loop = true;
      return;
    }
    // iPhone só mostra o quadro após o vídeo ter "tocado" uma vez
    v.play().then(() => v.pause()).catch(() => {});
  }, []);

  useScrollProgress(wrap, (p) => {
    if (still) return;
    const v = video.current;
    if (v && v.duration && !v.seeking) {
      const t = p * (v.duration - 0.05);
      if (Math.abs(v.currentTime - t) > 0.016) v.currentTime = t;
    }
    // cada frase ocupa um terço da rolagem: entra, fica e sai
    lines.current.forEach((el, i) => {
      if (!el) return;
      const c = (i + 0.5) / OPENING.length;
      const d = Math.abs(p - c) * OPENING.length;
      const last = i === OPENING.length - 1 && p > c;
      const first = i === 0 && p < c;
      const o = last || first ? 1 : Math.max(0, Math.min(1, (0.62 - d) / 0.22));
      el.style.opacity = String(o);
      el.style.transform = `translate3d(0, ${(p - c) * -90}px, 0)`;
      el.style.visibility = o < 0.01 ? "hidden" : "visible";
    });
    if (bar.current) bar.current.style.transform = `scaleX(${p})`;
    if (hint.current) hint.current.style.opacity = String(Math.max(0, 1 - p * 8));
  }, 0.12);

  return (
    <section ref={wrap} aria-label="Apresentação" className={cx("relative", still ? "h-auto" : "h-[340vh]")}>
      <div className={cx("top-0 h-[100svh] overflow-hidden", still ? "relative" : "sticky")}>
        <video ref={video} className="absolute inset-0 size-full object-cover" poster={LUX("fogo-rolagem.jpg")} muted playsInline preload="auto" autoPlay={still} aria-hidden />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgb(11_10_8/0.88)_0%,rgb(11_10_8/0.55)_45%,rgb(11_10_8/0.25)_100%)]" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-noir" />

        <div className="relative mx-auto flex h-full max-w-7xl items-end px-5 pb-28 sm:items-center sm:px-8 sm:pb-0">
          <div className="relative w-full max-w-4xl">
            {OPENING.map((l, i) => (
              <div
                key={i}
                ref={(el) => {
                  lines.current[i] = el;
                }}
                className={cx(still ? "relative mb-16" : "absolute inset-x-0 bottom-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2", "will-change-[opacity,transform]")}
                style={still || i === 0 ? undefined : { opacity: 0, visibility: "hidden" }}
              >
                <Kicker>{l.kicker}</Kicker>
                {i === 0 ? (
                  <h1 className="mt-6 font-lux-serif text-[2.9rem] font-bold leading-[1.02] tracking-[-0.01em] text-ivory sm:text-[5.6rem]">{l.title}</h1>
                ) : (
                  <p className="mt-6 font-lux-serif text-[2.6rem] font-bold leading-[1.04] text-ivory sm:text-[4.8rem]">{l.title}</p>
                )}
                {l.text && <p className="mt-6 max-w-xl font-lux-sans text-[15px] font-semibold leading-[1.8] text-ivory/90 sm:text-base">{l.text}</p>}
                {(i === 0 || i === OPENING.length - 1) && (
                  <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                    <CTA />
                    <CTA to={PANEL} variant="line">
                      Testar o painel
                    </CTA>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {!still && (
          <>
            <div ref={hint} className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 font-lux-sans text-[10px] uppercase tracking-[0.3em] text-ivory/90 sm:flex">
              Role para descobrir
              <span className="h-10 w-px animate-pulse bg-ivory/50" />
            </div>
            <div className="absolute inset-x-0 bottom-0 h-px bg-ivory/10">
              <div ref={bar} className="h-full origin-left bg-champagne" style={{ transform: "scaleX(0)" }} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Manifesto: as palavras acendem conforme a rolagem                 */
/* ------------------------------------------------------------------ */

const MANIFESTO =
  "Um prato bonito merece ser visto antes de ser provado. A Luma transforma o seu cardápio numa vitrine: luz, textura e vontade em cada foto, e o pedido chegando organizado no seu WhatsApp.";

function Manifesto() {
  const ref = useRef<HTMLElement>(null);
  const box = useRef<HTMLParagraphElement>(null);
  const words = MANIFESTO.split(" ");
  useScrollProgress(ref, (p) => box.current?.style.setProperty("--p", String(Math.min(1, p * 1.25))), 0.2);
  return (
    <section ref={ref} className="relative h-[180vh] bg-noir">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <Ornament side="right" />
        <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
          <Kicker>Manifesto</Kicker>
          <p ref={box} className="mt-8 font-lux-serif text-[2.1rem] font-bold leading-[1.18] text-ivory sm:text-[3.3rem] sm:leading-[1.1]" style={{ "--p": 0 } as CSSProperties}>
            {words.map((w, i) => (
              <span key={i} className="transition-opacity duration-200 motion-reduce:!opacity-100" style={{ opacity: `clamp(0.14, calc(var(--p) * ${words.length + 4} - ${i}), 1)` }}>
                {w}{" "}
              </span>
            ))}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Como funciona: três capítulos, cada um com o seu vídeo            */
/* ------------------------------------------------------------------ */

const CHAPTERS = [
  { n: "I", video: "prato", title: "O cliente abre o seu link", text: "Pelo Instagram, pelo status do WhatsApp ou pelo QR Code da mesa. Vê fotos, vídeos e o que está aberto agora." },
  { n: "II", video: "forno", title: "Monta a sacola em poucos toques", text: "Ponto da carne, adicionais e observações. Entrega ou retirada, bairro, pagamento e troco." },
  { n: "III", video: "chama", title: "O pedido chega no seu WhatsApp", text: "Com itens, adicionais, endereço, taxa, desconto e total já calculados. É só confirmar e preparar." },
];

function OrderMessage() {
  return (
    <div className="w-full max-w-[340px] rounded-[22px] border border-ivory/10 bg-noir/70 p-3 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
      <p className="mb-2 text-center font-lux-sans text-[9.5px] font-semibold uppercase tracking-[0.28em] text-ivory/45">Como chega no WhatsApp</p>
      <div className="rounded-2xl rounded-tr-sm bg-[#005c4b] px-4 py-3 font-mono text-[11.5px] leading-relaxed text-[#e9edef]">
        <p><b>Novo pedido #4821</b> · Brasa Burger</p>
        <p className="mt-1.5"><b>ENTREGA</b> · Ana · Setor Oeste</p>
        <p className="text-white/50">────────────</p>
        <p><b>2x Brasa Burger</b> — R$ 83,80</p>
        <p className="pl-3 text-white/80">• Ao ponto · + Bacon</p>
        <p><b>1x Fritas Rústicas</b> — R$ 18,90</p>
        <p className="text-white/50">────────────</p>
        <p>Cupom BEMVINDO10: – R$ 10,27</p>
        <p><b>Total: R$ 92,43</b> · Pix</p>
      </div>
    </div>
  );
}

function Chapters() {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const bar = useRef<HTMLDivElement>(null);
  useScrollProgress(ref, (p) => {
    const i = Math.min(CHAPTERS.length - 1, Math.floor(p * CHAPTERS.length));
    setActive((a) => (a === i ? a : i));
    if (bar.current) bar.current.style.transform = `scaleY(${p})`;
  }, 0.3);
  return (
    <section ref={ref} id="como-funciona" className="relative scroll-mt-0 bg-noir motion-safe:h-[330vh]">
      <div className="top-0 h-[100svh] overflow-hidden motion-safe:sticky">
        {CHAPTERS.map((c, i) => (
          <div key={c.n} className={cx("absolute inset-0 transition-opacity duration-1000 ease-out", active === i ? "opacity-100" : "opacity-0")}>
            <LoopVideo name={c.video} active={active === i} className={cx("transition-transform duration-[2500ms] ease-out", active === i ? "scale-100" : "scale-110")} />
          </div>
        ))}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-noir via-noir/55 to-noir/30 lg:bg-gradient-to-r lg:from-noir lg:via-noir/70 lg:to-noir/10" />

        <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end gap-10 px-5 pb-16 pt-28 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:pb-0">
          <div className="flex w-full max-w-2xl gap-6 sm:gap-10">
            <div className="relative hidden w-px bg-ivory/15 sm:block">
              <div ref={bar} className="absolute inset-x-0 top-0 h-full origin-top bg-champagne" style={{ transform: "scaleY(0)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <Kicker>Como funciona</Kicker>
              <div className="relative mt-6 min-h-[250px] sm:min-h-[270px]">
                {CHAPTERS.map((c, i) => (
                  <div key={c.n} className={cx("absolute inset-0 transition-all duration-700 ease-out", active === i ? "translate-y-0 opacity-100" : active > i ? "-translate-y-6 opacity-0" : "translate-y-6 opacity-0")} aria-hidden={active !== i}>
                    <p className="font-lux-serif font-bold text-2xl italic text-champagne">Capítulo {c.n}</p>
                    <h2 className="mt-3 font-lux-serif text-[2.3rem] font-bold leading-[1.06] text-ivory sm:text-[3.8rem]">{c.title}</h2>
                    <p className="mt-5 max-w-md font-lux-sans text-[15px] font-semibold leading-[1.8] text-ivory/90">{c.text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2" aria-hidden>
                {CHAPTERS.map((c, i) => (
                  <span key={c.n} className={cx("h-px transition-all duration-500", active === i ? "w-10 bg-champagne" : "w-5 bg-ivory/25")} />
                ))}
              </div>
            </div>
          </div>
          <div className={cx("hidden transition-all duration-700 lg:block", active === 2 ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0")}>
            <OrderMessage />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Experimente + recursos                                            */
/* ------------------------------------------------------------------ */

/** Celular com o cardápio de exemplo funcionando de verdade dentro. */
function PhoneDemo() {
  const [load, setLoad] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setLoad(true), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="relative mx-auto w-[290px] max-w-full sm:w-[320px]">
      <div aria-hidden className="absolute -inset-16 rounded-full bg-champagne/10 blur-3xl" />
      <div className="relative aspect-[9/19] w-full overflow-hidden rounded-[46px] border border-ivory/15 bg-noir-3 p-[9px] shadow-[0_60px_120px_-40px_rgba(0,0,0,0.9)]">
        <div className="absolute left-1/2 top-[18px] z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-noir" />
        {load ? <iframe title="Cardápio de exemplo" src={DEMO} className="size-full rounded-[38px] bg-[#f6f1e8]" loading="lazy" /> : <div className="size-full rounded-[38px] bg-noir-2" />}
      </div>
      <p className="relative mt-5 text-center font-lux-sans text-[10.5px] uppercase tracking-[0.24em] text-ivory/70">Toque e teste · o pedido abre no WhatsApp</p>
    </div>
  );
}

const FEATURES = [
  ["Fotos e vídeos que dão fome", "Capa com vídeos curtos do preparo passando como stories, e foto em cada produto."],
  ["Adicionais e escolhas", "Ponto da carne, tamanho, sabor e extras pagos, com opções obrigatórias e limite de escolhas."],
  ["Entrega por bairro", "Cada bairro com sua taxa, frete grátis acima de um valor e preenchimento pelo CEP."],
  ["Retirada no balcão", "O cliente escolhe entre entrega e retirada, cada um com o seu tempo de preparo."],
  ["Cupons de desconto", "Porcentagem ou valor fixo, ativados e desativados quando quiser."],
  ["Aberto e fechado sozinho", "O cardápio mostra o horário de hoje e avisa quando a loja abre."],
  ["Esgotado com um toque", "Acabou o pão? Marque o produto como esgotado e ele para de ser vendido na hora."],
  ["Com a cara da sua loja", "Seu logo, sua cor, seus textos. Nada de visual genérico de aplicativo."],
  ["QR Code no balcão e na mesa", "Cada mesa com o seu QR Code: o pedido chega com o número da mesa."],
] as const;

/** Faz o bloco surgir suavemente quando entra na tela. */
function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cx("transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] motion-reduce:transition-none", on ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function Experience() {
  return (
    <section id="recursos" className="relative scroll-mt-20 bg-noir py-28 sm:py-40">
      <Ornament side="left" />
      <div className="relative mx-auto grid max-w-7xl gap-20 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Reveal>
            <Kicker>Experimente</Kicker>
            <h2 className="mt-6 font-lux-serif text-[2.4rem] font-bold leading-[1.06] text-ivory sm:text-[3.8rem]">
              Prove antes de <em className="text-champagne">servir.</em>
            </h2>
            <p className="mt-6 max-w-md font-lux-sans text-[15px] font-semibold leading-[1.8] text-ivory/90">Este é um cardápio de verdade, funcionando aqui dentro. Escolha um lanche, monte a sacola e veja como o pedido sai.</p>
          </Reveal>
          <div className="mt-14">
            <PhoneDemo />
          </div>
        </div>
        <div>
          <Reveal>
            <Kicker>Recursos</Kicker>
            <h2 className="mt-6 font-lux-serif text-[2.4rem] font-bold leading-[1.05] text-ivory sm:text-[3.4rem]">Tudo o que um cardápio precisa para vender mais.</h2>
            <p className="mt-5 max-w-lg font-lux-sans text-[15px] font-semibold leading-[1.8] text-ivory/65">Para hamburguerias, pizzarias, restaurantes, cafés, açaí, marmitas e doceiras que vendem pelo WhatsApp.</p>
          </Reveal>
          <ol className="mt-14 border-t border-ivory/10">
            {FEATURES.map(([t, d], i) => (
              <li key={t}>
                <Reveal className="group grid grid-cols-[3.2rem_1fr] gap-x-4 border-b border-ivory/10 py-7 sm:grid-cols-[4.5rem_1fr]" delay={(i % 3) * 60}>
                  <span className="font-lux-serif font-bold text-xl italic text-champagne/80">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="font-lux-serif text-[1.65rem] font-bold leading-tight text-ivory transition-colors duration-300 group-hover:text-champagne-2">{t}</h3>
                    <p className="mt-2 max-w-lg font-lux-sans text-[14px] font-semibold leading-[1.75] text-ivory/90">{d}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Painel                                                            */
/* ------------------------------------------------------------------ */

function PanelSection() {
  return (
    <section className="relative overflow-hidden border-t border-ivory/10 bg-noir-2 py-28 sm:py-40">
      <Ornament side="right" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-5 sm:px-8 lg:grid-cols-2">
        <Reveal>
          <Kicker>O painel</Kicker>
          <h2 className="mt-6 font-lux-serif text-[2.3rem] font-bold leading-[1.06] text-ivory sm:text-[3.7rem]">
            Você muda o cardápio <em className="text-champagne">em segundos.</em>
          </h2>
          <p className="mt-6 max-w-md font-lux-sans text-[15px] font-semibold leading-[1.8] text-ivory/90">Preço, foto, produto novo, bairro, horário. Salvou, está no ar. Pelo celular, sem pedir para ninguém e sem esperar.</p>
          <ul className="mt-10 space-y-4 font-lux-sans text-[14px] font-semibold text-ivory/90">
            {["Painel em português, simples para quem atende no balcão", "Prévia do cardápio antes de publicar", "Modelo pronto para começar rápido", "Equipe com acesso: administrador, editor e consulta"].map((t) => (
              <li key={t} className="flex items-center gap-4">
                <span className="h-px w-6 shrink-0 bg-champagne" />
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-12">
            <CTA to={PANEL}>Testar o painel</CTA>
          </div>
        </Reveal>
        <Reveal delay={150}>
          <div className="relative overflow-hidden rounded-[28px] border border-ivory/10 bg-noir/80 p-6 shadow-[0_60px_120px_-40px_rgba(0,0,0,0.9)] sm:p-9">
            <div className="flex items-center gap-2.5 font-lux-sans text-[11px] uppercase tracking-[0.24em] text-ivory/90">
              <span className="size-2 rounded-full bg-[#7fd1a4] shadow-[0_0_12px_#7fd1a4]" /> Cardápio no ar
            </div>
            <p className="mt-4 font-lux-serif font-bold text-2xl text-ivory sm:text-3xl">gestãoluma.com.br/c/?l=sua-loja</p>
            <div className="mt-8 divide-y divide-ivory/[0.08] border-y border-ivory/[0.08]">
              {[
                ["Smash Bacon Duplo", "R$ 34,90", true],
                ["Brasa Burger", "R$ 36,90", true],
                ["Milkshake Nutella", "R$ 22,90", false],
              ].map(([n, p, on]) => (
                <div key={String(n)} className="flex items-center gap-4 py-4 font-lux-sans">
                  <span className="flex-1 text-[14px] text-ivory">{n}</span>
                  <span className="text-[13px] tabular text-ivory/90">{p}</span>
                  <span className={cx("w-20 text-right text-[10px] font-semibold uppercase tracking-[0.18em]", on ? "text-champagne" : "text-ivory/35")}>{on ? "Vendendo" : "Esgotado"}</span>
                </div>
              ))}
            </div>
            <p className="mt-6 font-lux-sans text-[13px] font-semibold text-ivory/55">Funciona no celular e no computador, sem instalar nada.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Planos, perguntas, convite final e rodapé                         */
/* ------------------------------------------------------------------ */

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
    <section id="planos" className={cx("relative scroll-mt-20 overflow-hidden bg-noir", standalone ? "pb-28 pt-40 sm:pb-40 sm:pt-48" : "border-t border-ivory/10 py-28 sm:py-40")}>
      <Ornament side="left" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="mb-16 max-w-3xl">
          <Kicker>Planos</Kicker>
          {standalone ? (
            <h1 className="mt-6 font-lux-serif text-[2.6rem] font-bold leading-[1.04] text-ivory sm:text-[4.6rem]">
              Um plano, um preço, <em className="text-champagne">sem comissão.</em>
            </h1>
          ) : (
            <h2 className="mt-6 font-lux-serif text-[2.3rem] font-bold leading-[1.06] text-ivory sm:text-[3.8rem]">
              Um plano, um preço, <em className="text-champagne">sem comissão.</em>
            </h2>
          )}
          <p className="mt-6 max-w-xl font-lux-sans text-[15px] font-semibold leading-[1.8] text-ivory/90">R$ 119,90 por mês por loja, com tudo incluído, ou o anual com 2 meses grátis. A gente monta o seu cardápio e os pedidos são todos seus.</p>
        </Reveal>
        <PricingCalculator />
      </div>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="perguntas" className="relative scroll-mt-20 overflow-hidden border-t border-ivory/10 bg-noir py-28 sm:py-40">
      <Ornament side="right" />
      <div className="relative mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <Kicker>Perguntas</Kicker>
          <h2 className="mt-6 font-lux-serif text-[2.3rem] font-bold leading-[1.06] text-ivory sm:text-[3.7rem]">
            O que todo mundo <em className="text-champagne">pergunta.</em>
          </h2>
          <p className="mt-6 font-lux-sans text-[15px] font-semibold text-ivory/90">Preço, pedidos, pagamento e como começar.</p>
        </Reveal>
        <div className="border-t border-ivory/10">
          {FAQ.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <div key={q} className="border-b border-ivory/10">
                <button className="flex w-full items-center justify-between gap-6 py-6 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i)}>
                  <span className={cx("font-lux-serif font-bold text-[1.45rem] leading-snug transition-colors duration-300 sm:text-[1.7rem]", isOpen ? "text-champagne-2" : "text-ivory")}>{q}</span>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full border border-ivory/20 text-ivory/90">{isOpen ? <LuMinus className="size-4" /> : <LuPlus className="size-4" />}</span>
                </button>
                <div className={cx("grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,0.61,0.36,1)]", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                  <p className="overflow-hidden pr-12 font-lux-sans text-[14.5px] font-semibold leading-[1.85] text-ivory/65">
                    <span className="block pb-7">{a}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden bg-noir">
      <div className="absolute inset-0">
        <LoopVideo name="salao" />
      </div>
      <div aria-hidden className="absolute inset-0 bg-noir/65" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-noir via-transparent to-noir" />
      <Reveal className="relative mx-auto max-w-5xl px-5 text-center sm:px-8">
        <Kicker>A mesa está posta</Kicker>
        <h2 className="mt-8 font-lux-serif text-[2.6rem] font-bold leading-[1.04] text-ivory sm:text-[5rem]">
          Seu cardápio no ar <em className="text-champagne">ainda esta semana.</em>
        </h2>
        <p className="mx-auto mt-8 max-w-xl font-lux-sans text-[15px] font-semibold leading-[1.8] text-ivory/90">Veja o exemplo funcionando, teste o painel e fale com a gente para montar o cardápio da sua loja.</p>
        <div className="mt-12 flex flex-col justify-center gap-3 sm:flex-row">
          <CTA />
          <CTA to={PLANS} variant="line">
            Ver planos
          </CTA>
        </div>
      </Reveal>
    </section>
  );
}

export function Footer() {
  const wa = whatsappLink();
  return (
    <footer className={cx("relative overflow-hidden border-t border-ivory/10 bg-noir py-16 font-lux-sans text-ivory/90")}>
      <Ornament side="left" />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 md:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-5 max-w-xs font-lux-serif font-bold text-xl italic text-ivory/90">Cardápio digital com pedido no WhatsApp.</p>
          <p className="mt-5 max-w-sm text-[12px] font-semibold leading-relaxed text-ivory/60">O cardápio de exemplo usa uma loja fictícia; o pedido de teste abre o WhatsApp de um número fictício.</p>
        </div>
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.28em] text-champagne">Produto</p>
          <ul className="mt-5 space-y-3 text-[13.5px] font-semibold">
            <li><a className="transition-colors hover:text-ivory" href={`${HOME}#recursos`}>Recursos</a></li>
            <li><a className="transition-colors hover:text-ivory" href={DEMO}>Cardápio de exemplo</a></li>
            <li><a className="transition-colors hover:text-ivory" href={PANEL}>Painel de demonstração</a></li>
            <li><a className="transition-colors hover:text-ivory" href={PLANS}>Planos</a></li>
          </ul>
        </div>
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.28em] text-champagne">Ajuda</p>
          <ul className="mt-5 space-y-3 text-[13.5px] font-semibold">
            <li><a className="transition-colors hover:text-ivory" href={`${HOME}#como-funciona`}>Como funciona</a></li>
            <li><a className="transition-colors hover:text-ivory" href={`${HOME}#perguntas`}>Perguntas frequentes</a></li>
            <li><a className="transition-colors hover:text-ivory" href={LOGIN}>Entrar (lojas)</a></li>
            {wa && (
              <li>
                <a className="inline-flex items-center gap-1 transition-colors hover:text-ivory" href={wa} target="_blank" rel="noopener noreferrer">
                  Falar no WhatsApp <LuArrowUpRight className="size-3.5" />
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-14 flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 border-t border-ivory/10 px-5 pb-16 pt-7 text-[11px] uppercase tracking-[0.18em] text-ivory/35 sm:px-8">
        <span>© {new Date().getFullYear()} Luma</span>
        <a href={href("/termos/")} className="transition-colors hover:text-ivory/90">
          Termos de uso
        </a>
        <a href={href("/privacidade/")} className="transition-colors hover:text-ivory/90">
          Privacidade
        </a>
        <a href={href("/admin/")} className="text-ivory/20 transition-colors hover:text-ivory/90" rel="nofollow">
          Acesso restrito
        </a>
      </div>
      <div className="fixed bottom-5 right-5 z-40 print:hidden">
        <HelpButton variant="pill" className="border border-champagne/40 bg-noir-3! font-lux-sans text-[11px]! uppercase tracking-[0.18em] text-champagne!" />
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="bg-noir font-lux-sans font-medium text-ivory">
      <Header overlay />
      <main>
        <Opening />
        <Manifesto />
        <Chapters />
        <Experience />
        <PanelSection />
        <PlansSection />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
