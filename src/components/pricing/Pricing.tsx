"use client";

import { useState } from "react";
import { LuCheck, LuLock, LuMessageCircle } from "react-icons/lu";
import { whatsappLink } from "@/lib/contact";
import { formatBRL } from "@/lib/format";
import { href } from "@/lib/paths";
import { checkout } from "@/lib/payments";
import { ANNUAL_PRICE, MAX_USERS, PLAN_PRICE, SETUP_PRICE, type Billing } from "@/lib/pricing";
import { cx, LogoMark } from "../ui";

const INCLUDED = [
  "Cardápio digital com link próprio da loja",
  "Pedidos completos direto no seu WhatsApp, sem comissão",
  "Fotos, vídeos de capa, destaques, promoções e cupons",
  "Entrega por bairro com taxa e retirada no balcão",
  "QR Code para o balcão e para cada mesa",
  "Horário automático e produto esgotado com um toque",
  `Até ${MAX_USERS} pessoas da equipe com acesso ao painel`,
  "Suporte pelo WhatsApp: a gente resolve com você",
];

const SETUP_INCLUDES = ["Montamos o cardápio com seus produtos e preços", "Ajustamos as fotos e a capa", "Entregamos os QR Codes das mesas prontos para imprimir"];

const STEPS = [
  ["Você escolhe o plano", "E paga pelo link seguro: Pix, boleto ou cartão."],
  ["A gente monta", "Você manda produtos, preços e fotos; deixamos o cardápio com a cara da loja em poucos dias."],
  ["Você divulga e vende", "Recebe o acesso ao painel, o link e os QR Codes. Qualquer dúvida, é só chamar no WhatsApp."],
];

const brl = (v: number) => formatBRL(v).replace(/\s/g, " ");

/** Plano único em duas formas de pagamento: mensal (com implantação) ou anual (implantação grátis). */
export function PricingCalculator() {
  const [billing, setBilling] = useState<Billing>("mensal");
  const wa = whatsappLink(billing);
  const pay = checkout();
  const annual = billing === "anual";
  const [reais, cents] = brl(annual ? ANNUAL_PRICE : PLAN_PRICE).split(",");

  return (
    <div className="grid items-start gap-5 font-lux-sans lg:grid-cols-[1.15fr_1fr]">
      <div className="relative overflow-hidden rounded-[28px] border border-champagne/25 bg-gradient-to-b from-noir-3 to-noir-2 p-6 text-ivory shadow-[0_60px_120px_-40px_rgba(0,0,0,0.9)] sm:p-10">
        <LogoMark tone="light" className="pointer-events-none absolute -bottom-24 -right-16 size-72 opacity-[0.06]" />
        <div className="relative">
          <div role="tablist" aria-label="Forma de pagamento" className="inline-flex rounded-full border border-ivory/10 bg-ivory/[0.04] p-1">
            {(["mensal", "anual"] as const).map((b) => (
              <button
                key={b}
                role="tab"
                aria-selected={billing === b}
                onClick={() => setBilling(b)}
                className={cx("rounded-full px-4 py-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] transition-colors duration-300", billing === b ? "bg-champagne text-noir" : "text-ivory/65 hover:text-ivory")}
              >
                {b === "mensal" ? "Mensal" : "Anual · 2 meses grátis"}
              </button>
            ))}
          </div>

          <p className="mt-6 flex flex-wrap items-end gap-1 font-lux-serif font-light leading-none">
            <span className="text-[4.8rem] tabular sm:text-[6.2rem]">{reais}</span>
            <span className="mb-2 text-2xl tabular sm:mb-3 sm:text-3xl">,{cents}</span>
            <span className="mb-2 ml-1 text-base font-medium tracking-normal text-ivory/55 sm:mb-3">{annual ? "por ano, à vista" : "/mês por loja"}</span>
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ivory/70">
            {annual ? (
              <>
                Equivale a {brl(ANNUAL_PRICE / 12)} por mês. <strong className="text-ivory">Implantação grátis</strong> (economia de {brl(SETUP_PRICE + PLAN_PRICE * 2)}).
              </>
            ) : (
              <>
                + <strong className="text-ivory">implantação de {brl(SETUP_PRICE)}</strong>, paga uma vez só. Sem fidelidade: cancele quando quiser.
              </>
            )}
          </p>

          <ul className="mt-7 grid gap-2.5 text-[15px] sm:grid-cols-2">
            {INCLUDED.map((i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-champagne/15 text-champagne">
                  <LuCheck className="size-3" />
                </span>
                <span className="text-ivory/90">{i}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {pay.kind === "link" && !annual ? (
              <a href={pay.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-champagne px-6 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-noir transition-colors hover:bg-champagne-2">
                <LuLock className="size-5" />
                Assinar agora
              </a>
            ) : wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-champagne px-6 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-noir transition-colors hover:bg-champagne-2">
                <LuMessageCircle className="size-5" />
                {annual ? "Quero o plano anual" : "Quero o plano mensal"}
              </a>
            ) : (
              <span aria-disabled="true" className="inline-flex h-12 flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-full bg-ivory/20 px-6 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-noir">
                Contratação em breve
              </span>
            )}
            <a href={href("/demo/")} className="inline-flex h-12 items-center justify-center rounded-full border border-ivory/30 px-6 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-ivory transition-colors hover:bg-ivory/5">
              Ver exemplo
            </a>
          </div>
          <p className="mt-4 text-xs text-ivory/45">
            Você recebe o link de pagamento seguro (Pix, boleto ou cartão) direto na conversa. Ao contratar, você concorda com os{" "}
            <a href={href("/termos/")} className="underline hover:text-ivory">
              Termos de uso
            </a>{" "}
            e a{" "}
            <a href={href("/privacidade/")} className="underline hover:text-ivory">
              Política de privacidade
            </a>
            .
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="rounded-[28px] border border-ivory/10 bg-noir-2 p-6 text-ivory sm:p-8">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-lux-serif text-2xl font-normal">Implantação</h3>
            <p className="font-lux-serif text-lg tabular text-ivory/80">{annual ? <span className="text-champagne">Grátis no anual</span> : `${brl(SETUP_PRICE)} · uma vez`}</p>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {SETUP_INCLUDES.map((t) => (
              <li key={t} className="flex gap-2.5">
                <LuCheck className="mt-0.5 size-4 shrink-0 text-champagne" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[28px] border border-ivory/10 bg-noir-2 p-6 text-ivory sm:p-8">
          <h3 className="font-lux-serif text-2xl font-normal">Como funciona a contratação</h3>
          <ol className="mt-5 space-y-5">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-champagne/50 font-lux-serif text-base italic text-champagne">{i + 1}</span>
                <div>
                  <p className="font-semibold">{t}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-ivory/60">{d}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-6 rounded-2xl border border-champagne/25 bg-champagne/[0.07] p-4 text-sm font-light leading-relaxed text-ivory/85">
            <strong>Conta de cabeça:</strong> um app de delivery cobra comissão em cada pedido. Na Luma você paga {brl(PLAN_PRICE)} por mês, venda 10 ou 1.000 pedidos.
          </div>
        </div>
      </div>
    </div>
  );
}
