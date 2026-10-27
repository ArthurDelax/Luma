"use client";

import { WEEKDAYS } from "@/lib/menu/logic";
import type { DayHours, StoreInfo } from "@/lib/menu/types";
import { cx, Field, Input } from "../../ui";
import { useEditor } from "./context";
import { MediaPicker, Panel, Toggle } from "./fields";

const ACCENTS = ["#de3f1c", "#c2410c", "#b91c1c", "#be185d", "#7c3aed", "#1d4ed8", "#0f766e", "#15803d", "#a16207", "#111111"];

export function useStore() {
  const { menu, update } = useEditor();
  const setStore = (patch: Partial<StoreInfo>) => update((m) => ({ ...m, store: { ...m.store, ...patch } }));
  return { store: menu.store, setStore };
}

export function StorePage() {
  const { store: s, setStore } = useStore();
  const { readOnly } = useEditor();
  const setHours = (d: number, h: DayHours) => setStore({ hours: s.hours.map((x, i) => (i === d ? h : x)) });

  return (
    <fieldset disabled={readOnly} className="space-y-5">
      <div>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2rem]">Loja</h1>
        <p className="mt-1 text-sm text-muted">Nome, logo, cor, horário e endereço. A foto e os vídeos do topo ficam em “Capa e vídeos”.</p>
      </div>

      <Panel title="Identidade">
        <div className="grid gap-5 sm:grid-cols-[140px_1fr]">
          <Field label="Logo">
            <MediaPicker value={s.logoUrl} onChange={(logoUrl) => setStore({ logoUrl })} label="Enviar logo" />
          </Field>
          <div className="space-y-4">
            <Field label="Nome da loja" htmlFor="s-name" required>
              <Input id="s-name" value={s.name} onChange={(e) => setStore({ name: e.target.value })} maxLength={60} />
            </Field>
            <div>
              <p className="mb-2 text-[13px] font-semibold">Cor principal</p>
              <div className="flex flex-wrap items-center gap-2">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Cor ${c}`}
                    aria-pressed={s.accent.toLowerCase() === c}
                    onClick={() => setStore({ accent: c })}
                    className={cx("size-9 rounded-full ring-offset-2 transition-transform active:scale-90", s.accent.toLowerCase() === c ? "ring-2 ring-ink" : "ring-1 ring-black/10")}
                    style={{ background: c }}
                  />
                ))}
                <label className="ml-1 inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-3 text-xs font-semibold">
                  <input type="color" value={/^#[0-9a-f]{6}$/i.test(s.accent) ? s.accent : "#de3f1c"} onChange={(e) => setStore({ accent: e.target.value })} className="size-5 cursor-pointer rounded border-0 bg-transparent p-0" />
                  Outra cor
                </label>
              </div>
              <p className="mt-2 text-xs text-muted">Usada nos botões, na sacola e nos destaques do cardápio.</p>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Horário de funcionamento" description="O cardápio mostra “Aberto agora” ou quando abre. Para fechar depois da meia-noite, use o horário do dia seguinte (ex.: 18:00 às 00:30).">
        <div className="divide-y divide-line">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const h = s.hours[d];
            return (
              <div key={d} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="w-24 shrink-0 text-sm font-semibold">{WEEKDAYS[d]}</span>
                <Toggle checked={!!h} onChange={(on) => setHours(d, on ? ["18:00", "23:00"] : null)} label={h ? "Aberto" : "Fechado"} />
                {h && (
                  <div className="flex items-center gap-2">
                    <Input type="time" value={h[0]} onChange={(e) => setHours(d, [e.target.value, h[1]])} className="w-28" aria-label={`${WEEKDAYS[d]}: abre`} />
                    <span className="text-sm text-muted">às</span>
                    <Input type="time" value={h[1]} onChange={(e) => setHours(d, [h[0], e.target.value])} className="w-28" aria-label={`${WEEKDAYS[d]}: fecha`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <Toggle checked={s.acceptWhenClosed} onChange={(acceptWhenClosed) => setStore({ acceptWhenClosed })} label="Receber pedidos com a loja fechada" hint="O cliente é avisado de que o pedido será preparado quando a loja abrir." />
        </div>
      </Panel>

      <Panel title="Endereço e redes" description="O endereço aparece no rodapé e para quem escolhe retirar.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Endereço" htmlFor="s-addr">
            <Input id="s-addr" value={s.address} onChange={(e) => setStore({ address: e.target.value })} placeholder="Rua, número – bairro" maxLength={120} />
          </Field>
          <Field label="Cidade" htmlFor="s-city">
            <Input id="s-city" value={s.city} onChange={(e) => setStore({ city: e.target.value })} placeholder="Cidade – UF" maxLength={60} />
          </Field>
          <Field label="Instagram" htmlFor="s-ig" hint="Sem o @">
            <Input id="s-ig" value={s.instagram ?? ""} onChange={(e) => setStore({ instagram: e.target.value.replace(/^@/, "") })} maxLength={40} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Nota exibida" htmlFor="s-rate" hint="Ex.: 4,8 (opcional)">
              <Input
                id="s-rate"
                inputMode="decimal"
                value={s.rating?.value ? String(s.rating.value).replace(".", ",") : ""}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(",", "."));
                  setStore({ rating: v > 0 && v <= 5 ? { value: v, count: s.rating?.count ?? 0 } : undefined });
                }}
              />
            </Field>
            <Field label="Avaliações" htmlFor="s-rcount">
              <Input id="s-rcount" type="number" min={0} value={s.rating?.count ?? ""} disabled={!s.rating} onChange={(e) => s.rating && setStore({ rating: { ...s.rating, count: Math.max(0, Number(e.target.value) || 0) } })} />
            </Field>
          </div>
        </div>
      </Panel>
    </fieldset>
  );
}
