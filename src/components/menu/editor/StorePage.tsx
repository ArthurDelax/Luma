"use client";

import { LuPlus, LuX } from "react-icons/lu";
import { WEEKDAYS } from "@/lib/menu/logic";
import type { DayHours, HeroClip, StoreInfo } from "@/lib/menu/types";
import { Button, cx, Field, IconButton, Input, Textarea } from "../../ui";
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
  const setClip = (i: number, patch: Partial<HeroClip>) => setStore({ heroClips: s.heroClips.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  return (
    <fieldset disabled={readOnly} className="space-y-5">
      <div>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2rem]">Loja</h1>
        <p className="mt-1 text-sm text-muted">Nome, textos, cores, fotos e horário que aparecem no topo do cardápio.</p>
      </div>

      <Panel title="Identidade" description="O que o cliente lê primeiro ao abrir o link.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome da loja" htmlFor="s-name" required>
            <Input id="s-name" value={s.name} onChange={(e) => setStore({ name: e.target.value })} maxLength={60} />
          </Field>
          <Field label="Frase curta" htmlFor="s-tag" hint="Ex.: Smash & artesanal · desde 2016">
            <Input id="s-tag" value={s.tagline} onChange={(e) => setStore({ tagline: e.target.value })} maxLength={60} />
          </Field>
          <Field label="Título do topo" htmlFor="s-head" className="sm:col-span-2" hint="A frase grande sobre a foto. Ex.: Feito na brasa, montado na hora.">
            <Input id="s-head" value={s.headline} onChange={(e) => setStore({ headline: e.target.value })} maxLength={70} />
          </Field>
          <Field label="Apresentação" htmlFor="s-desc" className="sm:col-span-2">
            <Textarea id="s-desc" value={s.description} onChange={(e) => setStore({ description: e.target.value })} maxLength={240} placeholder="O que faz a sua loja especial, em uma ou duas frases." />
          </Field>
          <div className="sm:col-span-2">
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
            <p className="mt-2 text-xs text-muted">Usada nos botões, na sacola e nos destaques.</p>
          </div>
        </div>
      </Panel>

      <Panel title="Fotos" description="O logo aparece no topo e no cartão da loja; a capa fica atrás do título.">
        <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
          <Field label="Logo">
            <MediaPicker value={s.logoUrl} onChange={(logoUrl) => setStore({ logoUrl })} label="Enviar logo" />
          </Field>
          <Field label="Foto de capa" hint="Horizontal, de preferência com o lanche em destaque.">
            <MediaPicker value={s.coverUrl} onChange={(coverUrl) => setStore({ coverUrl })} aspect="aspect-[16/8]" label="Enviar capa" />
          </Field>
        </div>
      </Panel>

      <Panel
        title="Vídeos do topo"
        description="Trechos curtos (5 a 10 segundos, até 20 MB cada) que passam em sequência no lugar da foto, como stories. Sem som. Opcional."
        actions={
          !readOnly &&
          s.heroClips.length < 5 && (
            <Button size="sm" variant="secondary" icon={<LuPlus className="size-4" />} onClick={() => setStore({ heroClips: [...s.heroClips, { url: "", label: "", start: 0, len: 6 }] })}>
              Adicionar vídeo
            </Button>
          )
        }
      >
        {s.heroClips.length === 0 ? (
          <p className="text-sm text-muted">Nenhum vídeo. O topo mostra a foto de capa.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {s.heroClips.map((c, i) => (
              <div key={i} className="rounded-2xl border border-line p-3">
                <div className="flex items-start gap-3">
                  <MediaPicker kind="video" value={c.url || undefined} onChange={(url) => setClip(i, { url: url ?? "" })} aspect="aspect-video" label="Enviar vídeo (MP4)" className="flex-1" />
                  <IconButton label="Remover vídeo" onClick={() => setStore({ heroClips: s.heroClips.filter((_, j) => j !== i) })}>
                    <LuX className="size-4" />
                  </IconButton>
                </div>
                <div className="mt-3 grid grid-cols-[1fr_80px_80px] gap-2">
                  <Field label="Legenda" htmlFor={`c-l-${i}`}>
                    <Input id={`c-l-${i}`} value={c.label} onChange={(e) => setClip(i, { label: e.target.value })} maxLength={30} placeholder="Direto na brasa" />
                  </Field>
                  <Field label="Início (s)" htmlFor={`c-s-${i}`}>
                    <Input id={`c-s-${i}`} type="number" min={0} max={120} value={c.start} onChange={(e) => setClip(i, { start: Math.max(0, Number(e.target.value) || 0) })} />
                  </Field>
                  <Field label="Dura (s)" htmlFor={`c-d-${i}`}>
                    <Input id={`c-d-${i}`} type="number" min={2} max={20} value={c.len} onChange={(e) => setClip(i, { len: Math.min(20, Math.max(2, Number(e.target.value) || 6)) })} />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        )}
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

      <Panel
        title="Faixa de promoções"
        description="Frases curtas que passam numa faixa abaixo do cartão da loja. Opcional."
        actions={
          !readOnly &&
          s.promos.length < 6 && (
            <Button size="sm" variant="secondary" icon={<LuPlus className="size-4" />} onClick={() => setStore({ promos: [...s.promos, ""] })}>
              Adicionar frase
            </Button>
          )
        }
      >
        {s.promos.length === 0 ? (
          <p className="text-sm text-muted">Sem faixa de promoções.</p>
        ) : (
          <div className="space-y-2">
            {s.promos.map((p, i) => (
              <div key={i} className="flex gap-2">
                <Input value={p} onChange={(e) => setStore({ promos: s.promos.map((x, j) => (j === i ? e.target.value : x)) })} maxLength={70} placeholder="Ex.: Frete grátis acima de R$ 80" aria-label={`Promoção ${i + 1}`} />
                <IconButton label="Remover frase" onClick={() => setStore({ promos: s.promos.filter((_, j) => j !== i) })}>
                  <LuX className="size-4" />
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </fieldset>
  );
}
