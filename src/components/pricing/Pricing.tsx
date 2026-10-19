"use client";

import { useState } from "react";
import { LuCheck, LuLock, LuMessageCircle, LuMinus, LuPlus, LuQrCode, LuUsers } from "react-icons/lu";
import { whatsappLink } from "@/lib/contact";
import { formatBRL } from "@/lib/format";
import { href } from "@/lib/paths";
import { checkoutFor, ONLINE_MAX_USERS } from "@/lib/payments";
import { EXTRA_USER_CENTS, INCLUDED_USERS, MAX_USERS, MIN_USERS, PRICE_TABLE, priceBreakdown } from "@/lib/pricing";
import { Button, cx, LogoMark, Modal } from "../ui";

const INCLUDED = [
  "Contas a pagar, boletos e Pix",
  "Leitura automática de boletos e guias em PDF",
  "Despesas recorrentes",
  "Contratos e documentos com alertas",
  "Calendário financeiro e relatórios",
  "Ambiente exclusivo da sua empresa",
];

/** Calculadora de preços com seleção de usuários, resumo e botões de contratação. */
export function PricingCalculator({ initialUsers = 3 }: { initialUsers?: number }) {
  const [users, setUsers] = useState(initialUsers);
  const [pixOpen, setPixOpen] = useState(false);
  const b = priceBreakdown(users);
  const wa = whatsappLink(users, b.total);
  const checkout = checkoutFor(users);
  const set = (n: number) => setUsers(Math.min(MAX_USERS, Math.max(MIN_USERS, n)));

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1.15fr_1fr]">
      {/* Calculadora */}
      <div className="dot-grid-light relative overflow-hidden rounded-[32px] bg-ink p-6 text-paper shadow-[0_40px_90px_-30px_rgba(17,17,17,0.55)] sm:p-8">
        <LogoMark tone="light" className="pointer-events-none absolute -bottom-24 -right-16 size-72 opacity-[0.05]" />
        <div className="relative">
          <p className="text-sm text-paper/55">Quantos usuários vão usar a Luma?</p>

          <div className="mt-4 flex items-center gap-4">
            <button
              type="button"
              onClick={() => set(users - 1)}
              disabled={users <= MIN_USERS}
              aria-label="Diminuir usuários"
              className="grid size-12 shrink-0 place-items-center rounded-full border border-white/15 text-paper transition-colors hover:bg-white/10 disabled:opacity-30"
            >
              <LuMinus className="size-5" />
            </button>
            <div className="flex-1 text-center">
              <p className="font-display text-[3.5rem] font-semibold leading-none tracking-[-0.04em] tabular" aria-live="polite">
                {users}
              </p>
              <p className="mt-1 text-sm text-paper/55">{users === 1 ? "usuário" : "usuários"}</p>
            </div>
            <button
              type="button"
              onClick={() => set(users + 1)}
              disabled={users >= MAX_USERS}
              aria-label="Aumentar usuários"
              className="grid size-12 shrink-0 place-items-center rounded-full border border-white/15 text-paper transition-colors hover:bg-white/10 disabled:opacity-30"
            >
              <LuPlus className="size-5" />
            </button>
          </div>

          <input
            type="range"
            min={MIN_USERS}
            max={MAX_USERS}
            step={1}
            value={users}
            onChange={(e) => set(Number(e.target.value))}
            aria-label="Quantidade de usuários"
            className="mt-6 w-full accent-[#f2f2ee]"
          />
          <div className="mt-1 flex justify-between text-[11px] text-paper/40 tabular">
            {PRICE_TABLE.map((p) => (
              <span key={p.users} className={cx("w-4 text-center", p.users === users && "font-semibold text-paper")}>
                {p.users}
              </span>
            ))}
          </div>

          <div className="mt-8 rounded-3xl border border-white/[0.08] bg-white/[0.04] p-5">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-paper/60">Plano base (até {INCLUDED_USERS} usuários)</dt>
                <dd className="tabular">{formatBRL(b.base)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-paper/60">
                  {b.extraUsers > 0 ? `${b.extraUsers} ${b.extraUsers === 1 ? "usuário adicional" : "usuários adicionais"} × ${formatBRL(EXTRA_USER_CENTS / 100)}` : "Usuários adicionais"}
                </dt>
                <dd className="tabular">{formatBRL(b.extraTotal)}</dd>
              </div>
            </dl>
            <div className="mt-4 flex items-end justify-between gap-4 border-t border-white/10 pt-4">
              <span className="text-sm text-paper/60">Total mensal</span>
              <span className="font-display text-[2.2rem] font-semibold leading-none tracking-[-0.03em] tabular">
                {formatBRL(b.total)}
                <span className="ml-1 text-base font-medium text-paper/50">/mês</span>
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {checkout.kind === "link" ? (
              <a
                href={checkout.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-paper px-6 text-[15px] font-semibold text-ink transition-colors hover:bg-white"
              >
                <LuLock className="size-5" />
                Assinar agora
              </a>
            ) : wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-paper px-6 text-[15px] font-semibold text-ink transition-colors hover:bg-white"
              >
                <LuMessageCircle className="size-5" />
                Contratar pelo WhatsApp
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setPixOpen(true)}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-paper px-6 text-[15px] font-semibold text-ink transition-colors hover:bg-white"
              >
                <LuQrCode className="size-5" />
                Contratar com Pix
              </button>
            )}
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-white/20 px-6 text-[15px] font-semibold text-paper transition-colors hover:bg-white/10"
              >
                <LuMessageCircle className="size-5" />
                Falar com um consultor
              </a>
            ) : (
              <span
                aria-disabled="true"
                title="O atendimento por WhatsApp será liberado em breve."
                className="inline-flex h-12 flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-full border border-white/10 px-6 text-[15px] font-semibold text-paper/40"
              >
                <LuMessageCircle className="size-5" />
                WhatsApp em breve
              </span>
            )}
          </div>
          <p className="mt-4 text-xs text-paper/45">
            {checkout.kind === "link"
              ? "Pagamento seguro pelo Asaas: Pix, boleto ou cartão. Cobrança mensal, sem fidelidade."
              : checkout.reason === "acima_do_limite"
                ? `Planos acima de ${ONLINE_MAX_USERS} usuários são contratados com um consultor pelo WhatsApp.`
                : "Você recebe o link de pagamento seguro (Pix, boleto ou cartão) direto na conversa. Cobrança mensal, sem fidelidade."}{" "}
            Ao contratar, você concorda com os{" "}
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

      {/* O que está incluído + tabela */}
      <div className="flex flex-col gap-5">
        <div className="card p-6">
          <h3 className="font-display text-lg font-semibold">Tudo incluído em todos os planos</h3>
          <ul className="mt-4 space-y-2.5 text-[15px]">
            {INCLUDED.map((i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink text-paper">
                  <LuCheck className="size-3" />
                </span>
                {i}
              </li>
            ))}
            <li className="flex gap-3">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink text-paper">
                <LuUsers className="size-3" />
              </span>
              Gestão de usuários e permissões a partir de 2 usuários
            </li>
          </ul>
        </div>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <caption className="px-5 pb-2 pt-5 text-left font-display text-base font-semibold">Mensalidade por quantidade de usuários</caption>
            <thead>
              <tr className="border-y border-line bg-paper/70 text-left text-xs font-semibold text-muted">
                <th className="px-5 py-2">Usuários</th>
                <th className="px-5 py-2 text-right">Mensalidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {PRICE_TABLE.map((p) => (
                <tr
                  key={p.users}
                  onClick={() => set(p.users)}
                  className={cx("cursor-pointer transition-colors", p.users === users ? "bg-ink text-paper" : "hover:bg-sky-50")}
                  aria-selected={p.users === users}
                >
                  <td className="px-5 py-2 tabular">{p.users}</td>
                  <td className="px-5 py-2 text-right font-semibold tabular">{formatBRL(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={pixOpen}
        onClose={() => setPixOpen(false)}
        size="sm"
        title="Contratar com Pix"
        description={`${users} ${users === 1 ? "usuário" : "usuários"} — ${formatBRL(b.total)} por mês`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPixOpen(false)}>
              Fechar
            </Button>
            {wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-paper hover:bg-navy-700">
                <LuMessageCircle className="size-4" /> Falar com um consultor
              </a>
            ) : (
              <a href={href("/app/")} className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-semibold text-paper hover:bg-navy-700">
                Explorar a demonstração
              </a>
            )}
          </>
        }
      >
        <div className="space-y-3 text-sm leading-relaxed text-slate-700">
          <p>
            A contratação online por Pix <strong>ainda não está ativa</strong>. Ela será liberada quando o ambiente seguro de pagamentos e contas estiver pronto.
          </p>
          <p>Quando estiver no ar, o fluxo será:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Você confirma o plano e informa os dados da empresa.</li>
            <li>Geramos uma cobrança Pix (QR Code e copia e cola).</li>
            <li>O pagamento é confirmado automaticamente pelo provedor.</li>
            <li>Seu ambiente exclusivo é criado vazio e você recebe o convite de acesso.</li>
          </ol>
          <p className="rounded-xl bg-paper px-3 py-2 text-xs text-muted">Nenhum valor é cobrado nesta página.</p>
        </div>
      </Modal>
    </div>
  );
}
