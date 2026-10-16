"use client";

import { LuArrowUpRight, LuTriangleAlert } from "react-icons/lu";
import { formatBRL } from "@/lib/format";
import { amountJump, percentText, riskSignals, type AmountJump, type RiskSignal } from "@/lib/insights";
import type { Bill } from "@/lib/types";

export interface BillInsight {
  risks: RiskSignal[];
  jump?: AmountJump;
}

/** Avisos de uma conta em aberto (contas pagas não geram aviso). */
export function insightFor(bill: Bill, bills: Bill[]): BillInsight {
  if (bill.paidAt) return { risks: [] };
  return { risks: riskSignals(bill, bills), jump: amountJump(bill, bills) };
}

/** Etiquetas curtas para as listas de contas. */
export function InsightTags({ insight }: { insight: BillInsight }) {
  if (!insight.risks.length && !insight.jump) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {insight.risks.length > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-overdue-soft px-2 py-0.5 text-[11px] font-semibold text-overdue" title={insight.risks.map((r) => r.message).join(" ")}>
          <LuTriangleAlert className="size-3" /> Confira antes de pagar
        </span>
      )}
      {insight.jump && (
        <span className="inline-flex items-center gap-1 rounded-full bg-soon-soft px-2 py-0.5 text-[11px] font-semibold text-soon" title={`Média das últimas contas: ${formatBRL(insight.jump.average)}`}>
          <LuArrowUpRight className="size-3" /> {percentText(insight.jump.increase)} acima da média
        </span>
      )}
    </span>
  );
}

/** Quadros explicativos (detalhe da conta). */
export function InsightPanels({ insight, supplier }: { insight: BillInsight; supplier: string }) {
  if (!insight.risks.length && !insight.jump) return null;
  return (
    <div className="mb-4 space-y-2">
      {insight.risks.length > 0 && (
        <div role="alert" className="rounded-xl border border-overdue/30 bg-overdue-soft p-3.5 text-sm">
          <p className="flex items-center gap-2 font-semibold text-overdue">
            <LuTriangleAlert className="size-4" /> Confira antes de pagar
          </p>
          <ul className="mt-1.5 space-y-1 text-slate-700">
            {insight.risks.map((r) => (
              <li key={r.kind}>• {r.message}</li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-muted">Confirme os dados com o fornecedor por um telefone que você já conhece. É um sinal de alerta, não uma confirmação de golpe.</p>
        </div>
      )}
      {insight.jump && (
        <div className="rounded-xl border border-soon/30 bg-soon-soft p-3.5 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <LuArrowUpRight className="size-4 text-soon" /> Valor {percentText(insight.jump.increase)} acima da média
          </p>
          <p className="mt-1 text-slate-700">
            As últimas {insight.jump.basedOn} contas de {supplier} ficaram em média em {formatBRL(insight.jump.average)}.
          </p>
        </div>
      )}
    </div>
  );
}
