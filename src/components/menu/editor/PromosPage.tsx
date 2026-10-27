"use client";

import { LuPlus, LuX } from "react-icons/lu";
import { formatBRL } from "@/lib/format";
import type { Coupon } from "@/lib/menu/types";
import { Button, IconButton, Input, Select } from "../../ui";
import { useEditor } from "./context";
import { MoneyInput, Panel, Toggle } from "./fields";
import { useStore } from "./StorePage";

const MAX_PROMOS = 6;

/** A faixa de promoções que passa abaixo do cartão da loja e os cupons de desconto. */
export function PromosPage() {
  const { store: s, setStore } = useStore();
  const { menu, update, readOnly } = useEditor();
  const setCoupons = (fn: (c: Coupon[]) => Coupon[]) => update((m) => ({ ...m, coupons: fn(m.coupons) }));
  const firstCoupon = menu.coupons.find((c) => c.active && c.code);

  const suggestions = [
    firstCoupon ? `Use o cupom ${firstCoupon.code} e ganhe ${firstCoupon.type === "pct" ? `${firstCoupon.value}%` : formatBRL(firstCoupon.value)} off` : "Use o cupom BEMVINDO10 e ganhe 10% off",
    s.delivery.freeFrom ? `Frete grátis acima de ${formatBRL(s.delivery.freeFrom)}` : "Frete grátis acima de R$ 80",
    "Terça em dobro: 2º lanche com 50% off",
    "Peça pelo cardápio e receba no WhatsApp",
  ].filter((t) => !s.promos.includes(t));

  const addPromo = (text = "") => s.promos.length < MAX_PROMOS && setStore({ promos: [...s.promos, text] });

  return (
    <fieldset disabled={readOnly} className="space-y-5">
      <div>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2rem]">Promoções</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">A faixa escura que passa com as ofertas no cardápio e os cupons que o cliente digita na sacola.</p>
      </div>

      <Panel
        title="Faixa de promoções"
        description="Frases curtas que passam, uma atrás da outra, logo abaixo do cartão da loja. Sem frases, a faixa não aparece."
        actions={
          !readOnly &&
          s.promos.length < MAX_PROMOS && (
            <Button size="sm" variant="secondary" icon={<LuPlus className="size-4" />} onClick={() => addPromo()}>
              Adicionar frase
            </Button>
          )
        }
      >
        <div className="mb-4 overflow-hidden rounded-2xl bg-[#16120e] px-4 py-3 text-[14px] font-bold text-[#f8eedd]">
          <p className="truncate">{s.promos.filter(Boolean).length ? s.promos.filter(Boolean).join("   ✦   ") : "Prévia: suas frases aparecem aqui"}</p>
        </div>
        {s.promos.length > 0 && (
          <div className="space-y-2">
            {s.promos.map((p, i) => (
              <div key={i} className="flex gap-2">
                <Input value={p} onChange={(e) => setStore({ promos: s.promos.map((x, j) => (j === i ? e.target.value : x)) })} maxLength={70} placeholder="Ex.: Frete grátis acima de R$ 80" aria-label={`Frase ${i + 1}`} />
                <IconButton label="Remover frase" onClick={() => setStore({ promos: s.promos.filter((_, j) => j !== i) })}>
                  <LuX className="size-4" />
                </IconButton>
              </div>
            ))}
          </div>
        )}
        {!readOnly && suggestions.length > 0 && s.promos.length < MAX_PROMOS && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted">Sugestões:</span>
            {suggestions.map((t) => (
              <button key={t} type="button" onClick={() => addPromo(t)} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold hover:border-ink/30">
                + {t}
              </button>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Cupons de desconto"
        description="O cliente digita o código na sacola e o desconto entra no total do pedido. Desative em vez de excluir se quiser usar de novo depois."
        actions={
          !readOnly && (
            <Button size="sm" variant="secondary" icon={<LuPlus className="size-4" />} onClick={() => setCoupons((c) => [...c, { code: "", type: "pct", value: 10, active: true }])}>
              Novo cupom
            </Button>
          )
        }
      >
        {menu.coupons.length === 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted">Nenhum cupom ainda.</p>
            {!readOnly && (
              <Button size="sm" variant="soft" onClick={() => setCoupons(() => [{ code: "BEMVINDO10", type: "pct", value: 10, active: true }])}>
                Criar BEMVINDO10 (10% off)
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {menu.coupons.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line p-2.5">
                <Input value={c.code} onChange={(e) => setCoupons((l) => l.map((x, j) => (j === i ? { ...x, code: e.target.value.toUpperCase().replace(/\s/g, "") } : x)))} placeholder="CÓDIGO" maxLength={20} aria-label="Código do cupom" className="w-40 font-semibold uppercase tracking-wide" />
                <Select value={c.type} onChange={(e) => setCoupons((l) => l.map((x, j) => (j === i ? { ...x, type: e.target.value as Coupon["type"] } : x)))} className="w-auto" aria-label="Tipo de desconto">
                  <option value="pct">% do pedido</option>
                  <option value="fix">Valor fixo (R$)</option>
                </Select>
                <div className="w-28">
                  {c.type === "pct" ? (
                    <Input type="number" min={1} max={100} value={c.value} onChange={(e) => setCoupons((l) => l.map((x, j) => (j === i ? { ...x, value: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } : x)))} aria-label="Porcentagem" />
                  ) : (
                    <MoneyInput value={c.value} onChange={(v) => setCoupons((l) => l.map((x, j) => (j === i ? { ...x, value: v ?? 0 } : x)))} />
                  )}
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <Toggle checked={c.active} onChange={(active) => setCoupons((l) => l.map((x, j) => (j === i ? { ...x, active } : x)))} label={c.active ? "Ativo" : "Inativo"} />
                  <IconButton label="Excluir cupom" onClick={() => setCoupons((l) => l.filter((_, j) => j !== i))}>
                    <LuX className="size-4" />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </fieldset>
  );
}
