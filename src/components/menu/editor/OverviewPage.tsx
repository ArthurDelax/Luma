"use client";

import { useEffect, useState } from "react";
import { LuCircleCheck, LuCircle, LuCopy, LuExternalLink, LuBadgePercent, LuEye, LuImage, LuLayers, LuPackageX, LuPrinter, LuSparkles, LuStar, LuUtensils } from "react-icons/lu";
import { allItems, publishChecklist, SLUG_RE, slugify } from "@/lib/menu/logic";
import { tableUrl } from "@/lib/menu/links";
import { qrPng } from "@/lib/menu/qr";
import { sampleMenu } from "@/lib/menu/sample";
import { BASE_PATH } from "@/lib/paths";
import { Badge, Button, cx, Field, Input, useConfirm, useToast } from "../../ui";
import { useEditor } from "./context";
import { Panel } from "./fields";
import type { Tab } from "./MenuEditor";

export function OverviewPage({ onPublish, onPreview, onGo, saving }: { onPublish: (published: boolean) => void; onPreview: () => void; onGo: (tab: Tab) => void; saving: boolean }) {
  const { record, setRecord, update, menu, readOnly, publicUrl, repo, clean } = useEditor();
  const toast = useToast();
  const confirm = useConfirm();
  const [slugText, setSlugText] = useState(record.slug);
  const [slugError, setSlugError] = useState("");
  const items = allItems(menu);
  const checklist = publishChecklist(menu);
  const essentials = checklist.filter((c) => c.id === "whatsapp" || c.id === "items" || c.id === "modes");
  const ready = essentials.every((c) => c.done);
  const url = publicUrl(record.slug);
  const empty = items.length === 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast("success", "Link copiado.");
    } catch {
      toast("error", "Não foi possível copiar. Selecione o link e copie.");
    }
  };

  const applySlug = async () => {
    const s = slugText.trim().toLowerCase();
    if (s === record.slug) return setSlugError("");
    if (!SLUG_RE.test(s)) return setSlugError("Use de 3 a 48 letras minúsculas, números e hífens (sem espaços ou acentos).");
    if (!(await repo.slugAvailable(s))) return setSlugError("Esse endereço já está em uso por outra loja.");
    setSlugError("");
    setRecord((r) => ({ ...r, slug: s }));
  };

  const useTemplate = async () => {
    if (
      !(await confirm({
        title: "Usar o modelo de hamburgueria?",
        message: "Preenche o cardápio com categorias, produtos, fotos de exemplo, adicionais e cupons de uma hamburgueria. Depois é só trocar nomes, preços e fotos pelos da loja. O nome e o WhatsApp da loja são mantidos.",
        confirmLabel: "Usar modelo",
      }))
    )
      return;
    const t = sampleMenu(BASE_PATH);
    update((m) => ({ ...t, store: { ...t.store, name: m.store.name, headline: m.store.headline || t.store.headline, whatsapp: m.store.whatsapp, rating: undefined } }));
    toast("success", "Modelo aplicado. Salve para guardar.");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2rem]">{menu.store.name || "Sua loja"}</h1>
        <p className="mt-1 text-sm text-muted">Monte o cardápio, publique e compartilhe o link no Instagram, no WhatsApp e nas mesas.</p>
      </div>

      <section className="dot-grid-light relative overflow-hidden rounded-[24px] bg-ink p-5 text-paper shadow-[var(--shadow-pop)] sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cx("size-2.5 rounded-full", record.published ? "bg-[#6fd3a0]" : "bg-paper/40")} />
              <span className="text-sm font-semibold">{record.published ? "Cardápio no ar" : "Rascunho: só você vê"}</span>
            </div>
            <p className="mt-3 break-all font-display text-lg font-semibold sm:text-xl">{url.replace(/^https?:\/\//, "")}</p>
            <p className="mt-1 text-sm text-paper/55">{record.published ? "Qualquer pessoa com o link abre o cardápio e faz pedidos." : "Publique quando o essencial estiver pronto."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<LuEye className="size-4" />} onClick={onPreview}>
              Ver prévia
            </Button>
            {record.published && (
              <>
                <Button variant="secondary" icon={<LuCopy className="size-4" />} onClick={copy}>
                  Copiar link
                </Button>
                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full border border-white/20 px-5 text-sm font-semibold text-paper hover:bg-white/10">
                  <LuExternalLink className="size-4" /> Abrir
                </a>
              </>
            )}
            {!readOnly && (
              <Button
                variant="secondary"
                disabled={saving || (!record.published && !ready)}
                onClick={() => onPublish(!record.published)}
                title={!record.published && !ready ? "Complete os itens essenciais primeiro" : undefined}
              >
                {saving ? "Salvando…" : record.published ? "Tirar do ar" : clean ? "Publicar cardápio" : "Salvar e publicar"}
              </Button>
            )}
          </div>
        </div>
      </section>

      {empty && !readOnly && (
        <Panel title="Comece por aqui" description="A loja está vazia. Monte do zero ou parta de um modelo pronto e ajuste.">
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => onGo("cardapio")} className="rounded-2xl border border-line bg-white p-4 text-left transition-colors hover:border-ink/30">
              <LuUtensils className="size-5" />
              <p className="mt-2 font-semibold">Montar do zero</p>
              <p className="text-sm text-muted">Crie as categorias e cadastre os produtos com fotos e preços.</p>
            </button>
            <button type="button" onClick={useTemplate} className="rounded-2xl border border-line bg-white p-4 text-left transition-colors hover:border-ink/30">
              <LuSparkles className="size-5" />
              <p className="mt-2 font-semibold">Usar modelo de hamburgueria</p>
              <p className="text-sm text-muted">Cardápio completo de exemplo, com fotos, adicionais e cupons, para editar.</p>
            </button>
          </div>
        </Panel>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Panel title="Antes de publicar" description="Os três primeiros são obrigatórios; os demais deixam o cardápio mais completo.">
          <ul className="space-y-1">
            {checklist.map((c) => {
              const target = c.id === "whatsapp" || c.id === "modes" || c.id === "zones" ? "pedidos" : c.id === "address" ? "loja" : "cardapio";
              const essential = essentials.some((e) => e.id === c.id);
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => onGo(target)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm hover:bg-sky-50">
                    {c.done ? <LuCircleCheck className="size-5 shrink-0 text-paid" /> : <LuCircle className={cx("size-5 shrink-0", essential ? "text-overdue" : "text-sky-300")} />}
                    <span className={cx("flex-1", c.done && "text-muted")}>{c.label}</span>
                    {!c.done && essential && <Badge tone="overdue">Obrigatório</Badge>}
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              [items.length, "produtos", <LuUtensils key="a" />],
              [menu.groups.length, "adicionais", <LuLayers key="b" />],
              [items.filter((i) => !i.available).length, "esgotados", <LuPackageX key="c" />],
            ].map(([n, l, ic]) => (
              <div key={String(l)} className="card p-4">
                <span className="grid size-8 place-items-center rounded-full bg-sky-100 [&>svg]:size-4">{ic}</span>
                <p className="mt-3 font-display text-2xl font-semibold tabular">{String(n)}</p>
                <p className="text-xs text-muted">{String(l)}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const blob = new Blob([JSON.stringify({ slug: record.slug, published: record.published, data: menu }, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `cardapio-${record.slug}.json`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 2000);
            }}
            className="text-left text-xs font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Baixar uma cópia do cardápio (backup)
          </button>
          <Panel title="Endereço do cardápio" description="A parte final do link. Mude antes de divulgar: links antigos deixam de funcionar.">
            <Field label="Endereço" htmlFor="ov-slug" error={slugError} hint={`Sugestão: ${slugify(menu.store.name)}`}>
              <div className="flex gap-2">
                <Input id="ov-slug" value={slugText} disabled={readOnly} onChange={(e) => setSlugText(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} onBlur={applySlug} onKeyDown={(e) => e.key === "Enter" && applySlug()} maxLength={48} />
                {!readOnly && slugText !== record.slug && (
                  <Button variant="secondary" onClick={applySlug}>
                    Usar
                  </Button>
                )}
              </div>
            </Field>
          </Panel>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <section className="card flex items-center gap-5 p-5 sm:p-6">
          <TableQr url={tableUrl(url, 1)} />
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold">QR Code das mesas</h2>
            <p className="mt-1 text-sm text-muted">
              {menu.store.dineIn.enabled ? `Pedido na mesa ativado para ${menu.store.dineIn.tables} mesas. Imprima os cartões e cole nas mesas.` : "Pedido na mesa desativado. Ative para o cliente pedir pelo celular direto da mesa."}
            </p>
            <Button className="mt-4" icon={<LuPrinter className="size-4" />} onClick={() => onGo("qrcode")}>
              {menu.store.dineIn.enabled ? "Imprimir QR das mesas" : "Ativar e imprimir"}
            </Button>
          </div>
        </section>
        <section className="card p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">Atalhos</h2>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([
              ["cardapio", "Produtos e preços", <LuUtensils key="a" />],
              ["destaques", "Destaques da casa", <LuStar key="b" />],
              ["capa", "Foto e vídeos do topo", <LuImage key="c" />],
              ["promocoes", "Faixa e cupons", <LuBadgePercent key="d" />],
            ] as const).map(([t, l, ic]) => (
              <button key={t} type="button" onClick={() => onGo(t)} className="flex flex-col items-start gap-2 rounded-2xl border border-line bg-white p-3 text-left text-sm font-semibold transition-colors hover:border-ink/30 [&>svg]:size-5">
                {ic}
                {l}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function TableQr({ url }: { url: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    qrPng(url, 320).then((s) => alive && setSrc(s), () => {});
    return () => {
      alive = false;
    };
  }, [url]);
  return (
    <span className="grid size-28 shrink-0 place-items-center rounded-2xl border border-line bg-white p-2">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="QR Code da mesa 1" className="size-full" />
      ) : (
        <span className="size-full animate-pulse rounded-xl bg-sky-100" />
      )}
    </span>
  );
}
