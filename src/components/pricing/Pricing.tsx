"use client";

import { LuCheck, LuLock, LuMessageCircle } from "react-icons/lu";
import { whatsappLink } from "@/lib/contact";
import { formatBRL } from "@/lib/format";
import { href } from "@/lib/paths";
import { checkout } from "@/lib/payments";
import { MAX_USERS, PLAN_PRICE } from "@/lib/pricing";
import { LogoMark } from "../ui";

const INCLUDED = [
  "Cardápio digital com link próprio da loja",
  "Pedidos completos direto no seu WhatsApp, sem comissão",
  "Fotos, vídeos de capa, adicionais e cupons",
  "Entrega por bairro com taxa e retirada no balcão",
  "Horário automático e produto esgotado com um toque",
  `Até ${MAX_USERS} pessoas da equipe com acesso ao painel`,
  "Cardápio montado pela Luma na contratação",
  "QR Code para o balcão e para cada mesa",
];

const STEPS = [
  ["Você assina", "Pelo link de pagamento seguro: Pix, boleto ou cartão."],
  ["A gente monta", "Você manda os produtos, preços e fotos; montamos o cardápio com a cara da loja."],
  ["Você divulga", "Recebe o acesso ao painel e o link para colocar no Instagram, no WhatsApp e nas mesas."],
];

/** Plano único: preço, o que está incluído e como contratar. */
export function PricingCalculator() {
  const wa = whatsappLink(PLAN_PRICE);
  const pay = checkout();
  const [reais, cents] = formatBRL(PLAN_PRICE).replace(/\s/g, " ").split(",");

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1.15fr_1fr]">
      <div className="dot-grid-light relative overflow-hidden rounded-[32px] bg-ink p-6 text-paper shadow-[var(--shadow-pop)] sm:p-9">
        <LogoMark tone="light" className="pointer-events-none absolute -bottom-24 -right-16 size-72 opacity-[0.06]" />
        <div className="relative">
          <span className="inline-flex rounded-full bg-paper/10 px-3 py-1 text-xs font-semibold text-paper/80">Plano único · tudo incluído</span>
          <p className="mt-6 flex flex-wrap items-end gap-1 font-display font-semibold leading-none tracking-[-0.04em]">
            <span className="text-[4rem] tabular sm:text-[5rem]">{reais}</span>
            <span className="mb-2 text-2xl tabular sm:mb-3 sm:text-3xl">,{cents}</span>
            <span className="mb-2 ml-1 text-base font-medium tracking-normal text-paper/55 sm:mb-3">/mês por loja</span>
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-paper/65">Sem comissão sobre os pedidos, sem taxa de adesão e sem fidelidade. Cancele quando quiser.</p>

          <ul className="mt-7 grid gap-2.5 text-[15px] sm:grid-cols-2">
            {INCLUDED.map((i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-ink">
                  <LuCheck className="size-3" />
                </span>
                <span className="text-paper/90">{i}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {pay.kind === "link" ? (
              <a href={pay.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-paper px-6 text-[15px] font-semibold text-ink transition-colors hover:bg-white">
                <LuLock className="size-5" />
                Assinar agora
              </a>
            ) : wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-paper px-6 text-[15px] font-semibold text-ink transition-colors hover:bg-white">
                <LuMessageCircle className="size-5" />
                Assinar pelo WhatsApp
              </a>
            ) : (
              <span aria-disabled="true" className="inline-flex h-12 flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-full bg-paper/30 px-6 text-[15px] font-semibold text-ink">
                Contratação em breve
              </span>
            )}
            {wa && pay.kind === "link" && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-white/20 px-6 text-[15px] font-semibold text-paper transition-colors hover:bg-white/10">
                <LuMessageCircle className="size-5" />
                Falar com a gente
              </a>
            )}
            <a href={href("/demo/")} className="inline-flex h-12 items-center justify-center rounded-full border border-white/20 px-6 text-[15px] font-semibold text-paper transition-colors hover:bg-white/10">
              Ver exemplo
            </a>
          </div>
          <p className="mt-4 text-xs text-paper/45">
            {pay.kind === "link" ? "Pagamento seguro pelo Asaas: Pix, boleto ou cartão." : "Você recebe o link de pagamento seguro (Pix, boleto ou cartão) direto na conversa."} Ao contratar, você concorda com os{" "}
            <a href={href("/termos/")} className="underline hover:text-paper">
              Termos de uso
            </a>{" "}
            e a{" "}
            <a href={href("/privacidade/")} className="underline hover:text-paper">
              Política de privacidade
            </a>
            .
          </p>
        </div>
      </div>

      <div className="card p-6 sm:p-7">
        <h3 className="font-display text-lg font-semibold">Como funciona a contratação</h3>
        <ol className="mt-5 space-y-5">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink font-display text-sm font-semibold text-paper">{i + 1}</span>
              <div>
                <p className="font-semibold">{t}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted">{d}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6 rounded-2xl bg-accent-soft p-4 text-sm leading-relaxed text-ink">
          <strong>Conta de cabeça:</strong> um app de delivery cobra comissão em cada pedido. Na Luma você paga {formatBRL(PLAN_PRICE)} por mês, venda 10 ou 1.000 pedidos.
        </div>
      </div>
    </div>
  );
}
