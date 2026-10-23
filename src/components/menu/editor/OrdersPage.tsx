"use client";

import { useState } from "react";
import { LuPlus, LuX } from "react-icons/lu";
import { isValidWhatsapp, uid } from "@/lib/menu/logic";
import type { Coupon } from "@/lib/menu/types";
import { Badge, Button, Field, IconButton, Input, Select } from "../../ui";
import { useEditor } from "./context";
import { MoneyInput, Panel, Toggle } from "./fields";
import { useStore } from "./StorePage";

/** (11) 99999-9999 enquanto digita. */
function mask(d: string): string {
  if (d.length > 10) return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
  if (d.length > 6) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  if (d.length > 2) return d.replace(/(\d{2})(\d{0,5})/, "($1) $2");
  return d;
}

function phoneDisplay(digits: string): string {
  return mask(digits.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, ""));
}

export function OrdersPage() {
  const { store: s, setStore } = useStore();
  const { menu, update, readOnly } = useEditor();
  const [phone, setPhone] = useState(phoneDisplay(s.whatsapp));
  const validPhone = isValidWhatsapp(s.whatsapp);

  const setDelivery = (patch: Partial<typeof s.delivery>) => setStore({ delivery: { ...s.delivery, ...patch } });
  const setCoupons = (fn: (c: Coupon[]) => Coupon[]) => update((m) => ({ ...m, coupons: fn(m.coupons) }));

  return (
    <fieldset disabled={readOnly} className="space-y-5">
      <div>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2rem]">Pedidos e entrega</h1>
        <p className="mt-1 text-sm text-muted">Para onde vão os pedidos, onde a loja entrega, quanto cobra e como o cliente paga.</p>
      </div>

      <Panel title="WhatsApp que recebe os pedidos" description="Quando o cliente finaliza, o WhatsApp dele abre com o pedido pronto para enviar a este número.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Número com DDD" htmlFor="o-wa" className="sm:w-72" error={phone && !validPhone ? "Número incompleto. Use DDD + número, ex.: (62) 99304-7680." : undefined}>
            <Input
              id="o-wa"
              type="tel"
              inputMode="numeric"
              value={phone}
              placeholder="(11) 90000-0000"
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
                setPhone(mask(d));
                setStore({ whatsapp: d ? `55${d}` : "" });
              }}
            />
          </Field>
          {validPhone && <Badge tone="paid">Pronto para receber pedidos</Badge>}
        </div>
      </Panel>

      <Panel title="Entrega" actions={<Toggle checked={s.delivery.enabled} onChange={(enabled) => setDelivery({ enabled })} label={s.delivery.enabled ? "Ativada" : "Desativada"} />}>
        {s.delivery.enabled ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Tempo de entrega" htmlFor="o-dtime" hint="Ex.: 40–60 min">
                <Input id="o-dtime" value={s.delivery.time} onChange={(e) => setDelivery({ time: e.target.value })} maxLength={20} />
              </Field>
              <Field label="Frete grátis a partir de" htmlFor="o-free" hint="Vazio = sem frete grátis">
                <MoneyInput id="o-free" value={s.delivery.freeFrom} allowEmpty placeholder="" onChange={(v) => setDelivery({ freeFrom: v || null })} />
              </Field>
              <Field label="Pedido mínimo" htmlFor="o-min" hint="0 = sem mínimo">
                <MoneyInput id="o-min" value={s.minOrder} onChange={(v) => setStore({ minOrder: v ?? 0 })} />
              </Field>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold">Bairros atendidos e taxas</p>
                {!readOnly && (
                  <Button size="sm" variant="soft" icon={<LuPlus className="size-4" />} onClick={() => setDelivery({ zones: [...s.delivery.zones, { id: uid("z"), name: "", fee: 0 }] })}>
                    Adicionar bairro
                  </Button>
                )}
              </div>
              {s.delivery.zones.length === 0 ? (
                <p className="rounded-xl bg-paper px-3 py-2.5 text-sm text-muted">Sem bairros cadastrados: o cliente informa o endereço e a taxa é combinada no WhatsApp.</p>
              ) : (
                <div className="space-y-2">
                  {s.delivery.zones.map((z, i) => (
                    <div key={z.id} className="flex items-center gap-2">
                      <Input value={z.name} onChange={(e) => setDelivery({ zones: s.delivery.zones.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder="Nome do bairro" maxLength={50} aria-label={`Bairro ${i + 1}`} className="flex-1" />
                      <div className="w-32 shrink-0">
                        <MoneyInput value={z.fee} onChange={(v) => setDelivery({ zones: s.delivery.zones.map((x, j) => (j === i ? { ...x, fee: v ?? 0 } : x)) })} />
                      </div>
                      <IconButton label="Remover bairro" onClick={() => setDelivery({ zones: s.delivery.zones.filter((_, j) => j !== i) })}>
                        <LuX className="size-4" />
                      </IconButton>
                    </div>
                  ))}
                  <p className="text-xs text-muted">Taxa 0 = entrega grátis naquele bairro. Quando o cliente digita o CEP, o bairro é escolhido sozinho se o nome for igual.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">A loja não faz entregas: o cliente só pode retirar.</p>
        )}
      </Panel>

      <Panel title="Retirada no balcão" actions={<Toggle checked={s.pickup.enabled} onChange={(enabled) => setStore({ pickup: { ...s.pickup, enabled } })} label={s.pickup.enabled ? "Ativada" : "Desativada"} />}>
        {s.pickup.enabled ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tempo para ficar pronto" htmlFor="o-ptime" hint="Ex.: 20–30 min">
              <Input id="o-ptime" value={s.pickup.time} onChange={(e) => setStore({ pickup: { ...s.pickup, time: e.target.value } })} maxLength={20} />
            </Field>
            {!s.delivery.enabled && (
              <Field label="Pedido mínimo" htmlFor="o-min2" hint="0 = sem mínimo">
                <MoneyInput id="o-min2" value={s.minOrder} onChange={(v) => setStore({ minOrder: v ?? 0 })} />
              </Field>
            )}
            <p className="text-sm text-muted sm:col-span-2 sm:self-end">O endereço de retirada é o da tela Loja{s.address ? `: ${s.address}` : " (ainda não preenchido)"}.</p>
          </div>
        ) : (
          <p className="text-sm text-muted">Sem retirada: todos os pedidos são para entrega.</p>
        )}
        {!s.delivery.enabled && !s.pickup.enabled && <p className="mt-3 rounded-xl bg-overdue-soft px-3 py-2 text-sm font-medium text-overdue">Ative a entrega ou a retirada para receber pedidos.</p>}
      </Panel>

      <Panel title="Formas de pagamento" description="O pagamento é feito direto com a loja; o cardápio só informa a escolha do cliente no pedido.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Toggle checked={s.payments.pix} onChange={(pix) => setStore({ payments: { ...s.payments, pix } })} label="Pix" hint="A loja envia a chave no WhatsApp" />
          <Toggle checked={s.payments.card} onChange={(card) => setStore({ payments: { ...s.payments, card } })} label="Cartão na entrega" hint="Crédito, débito e vale-refeição" />
          <Toggle checked={s.payments.cash} onChange={(cash) => setStore({ payments: { ...s.payments, cash } })} label="Dinheiro" hint="Pergunta se precisa de troco" />
        </div>
      </Panel>

      <Panel
        title="Cupons de desconto"
        description="O cliente digita o código na sacola. Desative em vez de excluir se quiser usar de novo depois."
        actions={
          !readOnly && (
            <Button size="sm" variant="secondary" icon={<LuPlus className="size-4" />} onClick={() => setCoupons((c) => [...c, { code: "", type: "pct", value: 10, active: true }])}>
              Novo cupom
            </Button>
          )
        }
      >
        {menu.coupons.length === 0 ? (
          <p className="text-sm text-muted">Nenhum cupom. Ex.: BEMVINDO10 para 10% no primeiro pedido.</p>
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
