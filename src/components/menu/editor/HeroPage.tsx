"use client";

import { LuPlus, LuX } from "react-icons/lu";
import type { HeroClip } from "@/lib/menu/types";
import { Button, Field, IconButton, Input, Textarea } from "../../ui";
import { useEditor } from "./context";
import { MediaPicker, Panel } from "./fields";
import { useStore } from "./StorePage";

/** O topo do cardápio: foto de fundo, vídeos em sequência e os textos por cima. */
export function HeroPage() {
  const { store: s, setStore } = useStore();
  const { readOnly } = useEditor();
  const setClip = (i: number, patch: Partial<HeroClip>) => setStore({ heroClips: s.heroClips.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  return (
    <fieldset disabled={readOnly} className="space-y-5">
      <div>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2rem]">Capa e vídeos</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">O fundo do topo do cardápio, a primeira coisa que o cliente vê. Use uma foto bonita do seu lanche e, se quiser, vídeos curtos do preparo.</p>
      </div>

      {/* prévia do topo */}
      <div className="relative overflow-hidden rounded-[24px] bg-navy-950 text-white shadow-[var(--shadow-pop)]">
        <div className="relative aspect-[16/9] max-h-[340px] w-full sm:aspect-[21/9]">
          {s.heroClips[0]?.url ? (
            <video key={s.heroClips[0].url} src={`${s.heroClips[0].url}#t=${s.heroClips[0].start}`} muted autoPlay loop playsInline className="absolute inset-0 size-full object-cover" />
          ) : s.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.coverUrl} alt="" className="absolute inset-0 size-full object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/85" />
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
            {s.tagline && <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">{s.tagline}</p>}
            <p className="mt-1 max-w-xl font-display text-2xl font-bold leading-tight tracking-tight sm:text-4xl">{s.headline || s.name}</p>
            {s.description && <p className="mt-2 hidden max-w-lg text-sm text-white/80 sm:block">{s.description}</p>}
          </div>
          <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold">Prévia do topo</span>
        </div>
      </div>

      <Panel title="Foto de fundo" description="Aparece atrás do título. Na horizontal, com o produto em destaque. Se houver vídeos, a foto aparece enquanto eles carregam.">
        <MediaPicker value={s.coverUrl} onChange={(coverUrl) => setStore({ coverUrl })} aspect="aspect-[16/7]" label="Enviar foto de fundo" className="max-w-xl" />
      </Panel>

      <Panel
        title="Vídeos do fundo"
        description="Trechos curtos (5 a 10 segundos, MP4, até 20 MB) que passam um depois do outro, como stories. Sem som. Opcional, até 5 vídeos."
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
          <p className="text-sm text-muted">Nenhum vídeo: o topo mostra a foto de fundo.</p>
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

      <Panel title="Textos do topo" description="Escritos por cima da foto ou dos vídeos.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Título grande" htmlFor="h-head" className="sm:col-span-2" hint="Ex.: Feito na brasa, montado na hora.">
            <Input id="h-head" value={s.headline} onChange={(e) => setStore({ headline: e.target.value })} maxLength={70} />
          </Field>
          <Field label="Frase curta acima do título" htmlFor="h-tag" hint="Ex.: Smash & artesanal · desde 2016">
            <Input id="h-tag" value={s.tagline} onChange={(e) => setStore({ tagline: e.target.value })} maxLength={60} />
          </Field>
          <Field label="Apresentação" htmlFor="h-desc" className="sm:col-span-2">
            <Textarea id="h-desc" value={s.description} onChange={(e) => setStore({ description: e.target.value })} maxLength={240} placeholder="O que faz a sua loja especial, em uma ou duas frases." />
          </Field>
        </div>
      </Panel>
    </fieldset>
  );
}
