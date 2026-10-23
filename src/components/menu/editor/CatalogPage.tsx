"use client";

import { useState } from "react";
import { LuArrowDown, LuArrowUp, LuCopy, LuEye, LuEyeOff, LuPencil, LuPlus, LuStar, LuTrash2, LuUtensils } from "react-icons/lu";
import { formatBRL } from "@/lib/format";
import { uid } from "@/lib/menu/logic";
import type { MenuCategory, MenuItem } from "@/lib/menu/types";
import { Badge, Button, cx, EmptyState, Field, IconButton, Input, Modal, ModalCloseButton, Select, Textarea, useConfirm, useToast } from "../../ui";
import { useEditor } from "./context";
import { MediaPicker, MoneyInput, Toggle } from "./fields";

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function CatalogPage({ onGoGroups }: { onGoGroups: () => void }) {
  const { menu, update, readOnly } = useEditor();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState<{ item: MenuItem; categoryId: string; isNew: boolean } | null>(null);
  const [catModal, setCatModal] = useState<MenuCategory | "new" | null>(null);

  const setCategories = (fn: (c: MenuCategory[]) => MenuCategory[]) => update((m) => ({ ...m, categories: fn(m.categories) }));

  const newItem = (categoryId: string) =>
    setEditing({ categoryId, isNew: true, item: { id: uid("item"), name: "", description: "", price: 0, available: true, groupIds: [] } });

  const saveItem = (item: MenuItem, categoryId: string) => {
    setCategories((cats) => {
      const without = cats.map((c) => ({ ...c, items: c.items.filter((i) => i.id !== item.id) }));
      return without.map((c) => {
        if (c.id !== categoryId) return c;
        const old = cats.find((x) => x.id === categoryId)?.items.findIndex((i) => i.id === item.id) ?? -1;
        const items = [...c.items];
        if (old >= 0) items.splice(old, 0, item);
        else items.push(item);
        return { ...c, items };
      });
    });
    setEditing(null);
  };

  const removeItem = async (item: MenuItem) => {
    if (!(await confirm({ title: `Excluir “${item.name || "produto"}”?`, message: "O produto sai do cardápio. Você pode desfazer com Descartar enquanto não salvar.", confirmLabel: "Excluir", danger: true }))) return;
    setCategories((cats) => cats.map((c) => ({ ...c, items: c.items.filter((i) => i.id !== item.id) })));
  };

  const duplicate = (item: MenuItem, categoryId: string) => {
    const copy = { ...item, id: uid("item"), name: `${item.name} (cópia)`, featured: false };
    setCategories((cats) => cats.map((c) => (c.id !== categoryId ? c : { ...c, items: c.items.flatMap((i) => (i.id === item.id ? [i, copy] : [i])) })));
    toast("success", "Produto duplicado.");
  };

  const patchItem = (categoryId: string, id: string, patch: Partial<MenuItem>) =>
    setCategories((cats) => cats.map((c) => (c.id !== categoryId ? c : { ...c, items: c.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })));

  const removeCategory = async (c: MenuCategory) => {
    if (c.items.length && !(await confirm({ title: `Excluir a categoria “${c.name}”?`, message: `Os ${c.items.length} produtos dela também saem do cardápio.`, confirmLabel: "Excluir categoria", danger: true }))) return;
    setCategories((cats) => cats.filter((x) => x.id !== c.id));
  };

  const total = menu.categories.reduce((s, c) => s + c.items.length, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2rem]">Cardápio</h1>
          <p className="mt-1 text-sm text-muted">
            {menu.categories.length} {menu.categories.length === 1 ? "categoria" : "categorias"} · {total} {total === 1 ? "produto" : "produtos"}. A ordem aqui é a ordem no cardápio.
          </p>
        </div>
        {!readOnly && (
          <Button icon={<LuPlus className="size-4" />} onClick={() => setCatModal("new")}>
            Nova categoria
          </Button>
        )}
      </div>

      {menu.categories.length === 0 && (
        <div className="card">
          <EmptyState icon={<LuUtensils className="size-6" />} title="Nenhuma categoria ainda" action={!readOnly && <Button onClick={() => setCatModal("new")}>Criar primeira categoria</Button>}>
            Comece por categorias como “Lanches”, “Bebidas” e “Sobremesas” e depois adicione os produtos.
          </EmptyState>
        </div>
      )}

      {menu.categories.map((c, ci) => (
        <section key={c.id} className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper/60 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-base font-semibold">{c.name || "Sem nome"}</h2>
              {c.description && <p className="truncate text-xs text-muted">{c.description}</p>}
            </div>
            {!readOnly && (
              <div className="flex items-center gap-0.5">
                <IconButton label="Subir categoria" disabled={ci === 0} onClick={() => setCategories((cats) => move(cats, ci, -1))}>
                  <LuArrowUp className="size-4" />
                </IconButton>
                <IconButton label="Descer categoria" disabled={ci === menu.categories.length - 1} onClick={() => setCategories((cats) => move(cats, ci, 1))}>
                  <LuArrowDown className="size-4" />
                </IconButton>
                <IconButton label="Editar categoria" onClick={() => setCatModal(c)}>
                  <LuPencil className="size-4" />
                </IconButton>
                <IconButton label="Excluir categoria" onClick={() => removeCategory(c)} className="hover:bg-overdue-soft hover:text-overdue">
                  <LuTrash2 className="size-4" />
                </IconButton>
              </div>
            )}
          </div>

          {c.items.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">Nenhum produto nesta categoria.</p>
          ) : (
            <ul className="divide-y divide-line">
              {c.items.map((it, ii) => (
                <li key={it.id} className={cx("flex items-center gap-3 px-4 py-3 sm:px-5", !it.available && "bg-paper/50")}>
                  <button type="button" onClick={() => setEditing({ item: it, categoryId: c.id, isNew: false })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-sky-100">
                      {it.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.image} alt="" className={cx("size-full object-cover", !it.available && "opacity-50 grayscale")} />
                      ) : (
                        <span className="grid size-full place-items-center text-[10px] font-semibold text-muted">sem foto</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-semibold">{it.name || "Sem nome"}</span>
                        {it.featured && (
                          <Badge tone="soon">
                            <LuStar className="size-3" /> Destaque
                          </Badge>
                        )}
                        {!it.available && <Badge tone="neutral">Esgotado</Badge>}
                      </span>
                      <span className="block truncate text-xs text-muted">{it.description || "Sem descrição"}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold tabular">{formatBRL(it.price)}</span>
                      {it.groupIds.length > 0 && <span className="block text-[11px] text-muted">{it.groupIds.length} adicionais</span>}
                    </span>
                  </button>
                  {!readOnly && (
                    <div className="hidden items-center gap-0.5 sm:flex">
                      <IconButton label={it.available ? "Marcar como esgotado" : "Voltar a vender"} onClick={() => patchItem(c.id, it.id, { available: !it.available })}>
                        {it.available ? <LuEye className="size-4" /> : <LuEyeOff className="size-4" />}
                      </IconButton>
                      <IconButton label="Subir" disabled={ii === 0} onClick={() => setCategories((cats) => cats.map((x) => (x.id === c.id ? { ...x, items: move(x.items, ii, -1) } : x)))}>
                        <LuArrowUp className="size-4" />
                      </IconButton>
                      <IconButton label="Descer" disabled={ii === c.items.length - 1} onClick={() => setCategories((cats) => cats.map((x) => (x.id === c.id ? { ...x, items: move(x.items, ii, 1) } : x)))}>
                        <LuArrowDown className="size-4" />
                      </IconButton>
                      <IconButton label="Duplicar" onClick={() => duplicate(it, c.id)}>
                        <LuCopy className="size-4" />
                      </IconButton>
                      <IconButton label="Excluir" onClick={() => removeItem(it)} className="hover:bg-overdue-soft hover:text-overdue">
                        <LuTrash2 className="size-4" />
                      </IconButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!readOnly && (
            <div className="border-t border-line px-4 py-3 sm:px-5">
              <Button size="sm" variant="soft" icon={<LuPlus className="size-4" />} onClick={() => newItem(c.id)}>
                Adicionar produto
              </Button>
            </div>
          )}
        </section>
      ))}

      {editing && (
        <ItemModal
          key={editing.item.id}
          initial={editing.item}
          categoryId={editing.categoryId}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onSave={saveItem}
          onRemove={
            editing.isNew
              ? undefined
              : () => {
                  const it = editing.item;
                  setEditing(null);
                  void removeItem(it);
                }
          }
          onGoGroups={() => {
            setEditing(null);
            onGoGroups();
          }}
        />
      )}
      {catModal && (
        <CategoryModal
          initial={catModal === "new" ? undefined : catModal}
          onClose={() => setCatModal(null)}
          onSave={(c) => {
            setCategories((cats) => (cats.some((x) => x.id === c.id) ? cats.map((x) => (x.id === c.id ? c : x)) : [...cats, c]));
            setCatModal(null);
          }}
        />
      )}
    </div>
  );
}

function CategoryModal({ initial, onClose, onSave }: { initial?: MenuCategory; onClose: () => void; onSave: (c: MenuCategory) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={initial ? "Editar categoria" : "Nova categoria"}
      footer={
        <>
          <ModalCloseButton />
          <Button type="submit" form="cat-form">
            {initial ? "Aplicar" : "Criar categoria"}
          </Button>
        </>
      }
    >
      <form
        id="cat-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length < 2) return setError("Informe o nome da categoria.");
          onSave({ id: initial?.id ?? uid("cat"), name: name.trim(), description: description.trim(), items: initial?.items ?? [] });
        }}
      >
        <Field label="Nome" htmlFor="cat-name" required error={error}>
          <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Lanches, Pizzas, Bebidas" maxLength={40} data-autofocus />
        </Field>
        <Field label="Descrição curta" htmlFor="cat-desc" hint="Aparece abaixo do nome no cardápio. Opcional.">
          <Input id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Todos acompanham batata" maxLength={90} />
        </Field>
      </form>
    </Modal>
  );
}

function ItemModal({
  initial,
  categoryId,
  isNew,
  onClose,
  onSave,
  onRemove,
  onGoGroups,
}: {
  initial: MenuItem;
  categoryId: string;
  isNew: boolean;
  onClose: () => void;
  onSave: (item: MenuItem, categoryId: string) => void;
  onRemove?: () => void;
  onGoGroups: () => void;
}) {
  const { menu, readOnly } = useEditor();
  const [it, setIt] = useState<MenuItem>(initial);
  const [cat, setCat] = useState(categoryId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (patch: Partial<MenuItem>) => {
    setIt((x) => ({ ...x, ...patch }));
    setErrors({});
  };
  const submit = () => {
    const e: Record<string, string> = {};
    if (it.name.trim().length < 2) e.name = "Informe o nome do produto.";
    if (!(it.price > 0)) e.price = "Informe o preço.";
    if (it.oldPrice !== undefined && it.oldPrice <= it.price) e.oldPrice = "O preço “de” precisa ser maior que o preço atual.";
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({ ...it, name: it.name.trim(), description: it.description.trim(), tag: it.tag?.trim() || undefined }, cat);
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isNew ? "Novo produto" : it.name || "Produto"}
      footer={
        readOnly ? (
          <ModalCloseButton>Fechar</ModalCloseButton>
        ) : (
          <>
            {onRemove && (
              <button type="button" className="mr-auto inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-overdue transition-colors hover:bg-overdue-soft" onClick={onRemove}>
                <LuTrash2 className="size-4" /> Excluir
              </button>
            )}
            <ModalCloseButton />
            <Button onClick={submit}>{isNew ? "Adicionar ao cardápio" : "Aplicar"}</Button>
          </>
        )
      }
    >
      <fieldset disabled={readOnly} className="grid gap-5 md:grid-cols-[220px_1fr]">
        <div className="space-y-2">
          <MediaPicker value={it.image} onChange={(image) => set({ image })} />
          <p className="text-xs text-muted">Foto quadrada ou na horizontal, bem iluminada. Reduzimos o tamanho automaticamente.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="it-name" required error={errors.name} className="sm:col-span-2">
            <Input id="it-name" value={it.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} placeholder="Ex.: X-Bacon da casa" data-autofocus />
          </Field>
          <Field label="Descrição" htmlFor="it-desc" className="sm:col-span-2" hint="Ingredientes e tamanho ajudam o cliente a decidir.">
            <Textarea id="it-desc" value={it.description} onChange={(e) => set({ description: e.target.value })} maxLength={220} placeholder="Pão brioche, blend 180g, cheddar e bacon crocante." />
          </Field>
          <Field label="Preço" htmlFor="it-price" required error={errors.price}>
            <MoneyInput id="it-price" value={it.price || undefined} onChange={(v) => set({ price: v ?? 0 })} />
          </Field>
          <Field label="Preço “de” (promoção)" htmlFor="it-old" error={errors.oldPrice} hint="Aparece riscado. Opcional.">
            <MoneyInput id="it-old" value={it.oldPrice} allowEmpty onChange={(v) => set({ oldPrice: v || undefined })} placeholder="" />
          </Field>
          <Field label="Categoria" htmlFor="it-cat">
            <Select id="it-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
              {menu.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Etiqueta" htmlFor="it-tag" hint="Ex.: Mais pedido, Novo, Picante">
            <Input id="it-tag" value={it.tag ?? ""} onChange={(e) => set({ tag: e.target.value })} maxLength={16} />
          </Field>
          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
            <Toggle checked={it.available} onChange={(available) => set({ available })} label="Disponível" hint="Desligado = esgotado" />
            <Toggle checked={!!it.featured} onChange={(featured) => set({ featured })} label="Destaque" hint="Aparece no topo" />
            <Toggle checked={!!it.veg} onChange={(veg) => set({ veg })} label="Vegetariano" />
          </div>
          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold">Adicionais e escolhas</p>
              <button type="button" className="text-xs font-semibold text-ink underline-offset-2 hover:underline" onClick={onGoGroups}>
                Gerenciar adicionais
              </button>
            </div>
            {menu.groups.length === 0 ? (
              <p className="rounded-xl bg-paper px-3 py-2.5 text-xs text-muted">Nenhum grupo criado. Crie grupos como “Ponto da carne” ou “Adicionais” na tela Adicionais e marque aqui quais valem para este produto.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {menu.groups.map((g) => {
                  const on = it.groupIds.includes(g.id);
                  return (
                    <button
                      type="button"
                      key={g.id}
                      aria-pressed={on}
                      onClick={() => set({ groupIds: on ? it.groupIds.filter((x) => x !== g.id) : [...it.groupIds, g.id] })}
                      className={cx("rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors", on ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink hover:border-ink/30")}
                    >
                      {g.title}
                      {g.required && <span className={cx("ml-1", on ? "text-paper/60" : "text-muted")}>· obrigatório</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </fieldset>
    </Modal>
  );
}
