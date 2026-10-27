"use client";

import { LuCheck, LuStar } from "react-icons/lu";
import { formatBRL } from "@/lib/format";
import { allItems } from "@/lib/menu/logic";
import type { MenuItem } from "@/lib/menu/types";
import { Badge, Button, cx, EmptyState, Input, useToast } from "../../ui";
import { useEditor } from "./context";
import { Panel } from "./fields";

export const MAX_FEATURED = 6;

/** “Destaques da casa”: os cartões grandes logo abaixo do topo do cardápio. */
export function HighlightsPage({ onGoCatalog }: { onGoCatalog: () => void }) {
  const { menu, update, readOnly } = useEditor();
  const toast = useToast();
  const items = allItems(menu);
  const featured = items.filter((i) => i.featured);

  const patch = (id: string, p: Partial<MenuItem>) =>
    update((m) => ({ ...m, categories: m.categories.map((c) => ({ ...c, items: c.items.map((i) => (i.id === id ? { ...i, ...p } : i)) })) }));

  const toggle = (it: MenuItem) => {
    if (readOnly) return;
    if (!it.featured && featured.length >= MAX_FEATURED) {
      toast("error", `Escolha até ${MAX_FEATURED} destaques. Tire um para colocar outro.`);
      return;
    }
    patch(it.id, { featured: !it.featured });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2rem]">Destaques da casa</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">Os cartões grandes com foto logo no começo do cardápio. Toque nos produtos para escolher até {MAX_FEATURED}: os mais vendidos, a novidade ou o combo que você quer empurrar.</p>
        </div>
        <Badge tone={featured.length ? "paid" : "neutral"}>
          {featured.length} de {MAX_FEATURED} escolhidos
        </Badge>
      </div>

      {featured.length > 0 && (
        <Panel title="Etiquetas dos destaques" description="O selo amarelo no canto da foto. Ex.: Mais pedido, Novo, Promoção. Vazio mostra “Favorito”.">
          <div className="grid gap-3 sm:grid-cols-2">
            {featured.map((it) => (
              <div key={it.id} className="flex items-center gap-3">
                <span className="size-11 shrink-0 overflow-hidden rounded-xl bg-sky-100">
                  {it.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image} alt="" className="size-full object-cover" />
                  )}
                </span>
                <span className="w-32 shrink-0 truncate text-sm font-semibold">{it.name}</span>
                <Input value={it.tag ?? ""} disabled={readOnly} onChange={(e) => patch(it.id, { tag: e.target.value || undefined })} placeholder="Favorito" maxLength={16} aria-label={`Etiqueta de ${it.name}`} />
              </div>
            ))}
          </div>
        </Panel>
      )}

      {items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<LuStar className="size-6" />} title="Cadastre produtos primeiro" action={<Button onClick={onGoCatalog}>Ir para o cardápio</Button>}>
            Os destaques são escolhidos entre os produtos do cardápio.
          </EmptyState>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              aria-pressed={!!it.featured}
              onClick={() => toggle(it)}
              disabled={readOnly}
              className={cx(
                "group relative overflow-hidden rounded-2xl border-2 bg-white text-left transition-[border-color,transform,box-shadow] duration-200 active:scale-[0.98]",
                it.featured ? "border-ink shadow-[var(--shadow-card)]" : "border-transparent hover:border-sky-300",
              )}
            >
              <span className="relative block aspect-[4/3] w-full bg-sky-100">
                {it.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image} alt="" className={cx("absolute inset-0 size-full object-cover transition-opacity", !it.featured && featured.length >= MAX_FEATURED && "opacity-60")} />
                ) : (
                  <span className="absolute inset-0 grid place-items-center text-xs text-muted">sem foto</span>
                )}
                <span className={cx("absolute right-2 top-2 grid size-7 place-items-center rounded-full border-2 transition-colors", it.featured ? "border-ink bg-ink text-paper" : "border-white/90 bg-black/20 text-transparent")}>
                  <LuCheck className="size-4" />
                </span>
              </span>
              <span className="block p-3">
                <span className="block truncate text-sm font-semibold">{it.name}</span>
                <span className="block text-xs text-muted tabular">{formatBRL(it.price)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-muted">Sem nenhum escolhido, o cardápio não mostra a seção de destaques.</p>
    </div>
  );
}
