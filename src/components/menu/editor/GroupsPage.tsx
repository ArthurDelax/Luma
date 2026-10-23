"use client";

import { useState } from "react";
import { LuArrowDown, LuArrowUp, LuLayers, LuPencil, LuPlus, LuTrash2, LuX } from "react-icons/lu";
import { formatBRL } from "@/lib/format";
import { allItems, uid } from "@/lib/menu/logic";
import type { OptionGroup } from "@/lib/menu/types";
import { Badge, Button, EmptyState, Field, IconButton, Input, Modal, ModalCloseButton, Segmented, useConfirm } from "../../ui";
import { useEditor } from "./context";
import { MoneyInput, Toggle } from "./fields";

const PRESETS: { title: string; group: Omit<OptionGroup, "id"> }[] = [
  { title: "Ponto da carne", group: { title: "Ponto da carne", label: "Ponto", type: "single", required: true, options: [{ name: "Mal passado", price: 0 }, { name: "Ao ponto", price: 0 }, { name: "Bem passado", price: 0 }] } },
  { title: "Adicionais", group: { title: "Turbine seu lanche", label: "Adicional", type: "multi", required: false, max: 4, options: [{ name: "Bacon", price: 5 }, { name: "Cheddar extra", price: 4 }, { name: "Ovo", price: 3 }] } },
  { title: "Tamanho", group: { title: "Tamanho", label: "Tamanho", type: "single", required: true, options: [{ name: "Pequeno", price: 0 }, { name: "Médio", price: 6 }, { name: "Grande", price: 12 }] } },
  { title: "Bebida do combo", group: { title: "Escolha a bebida", label: "Bebida", type: "single", required: true, options: [{ name: "Coca-Cola lata", price: 0 }, { name: "Guaraná lata", price: 0 }, { name: "Água", price: 0 }] } },
];

export function GroupsPage() {
  const { menu, update, readOnly } = useEditor();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<OptionGroup | null>(null);
  const [isNew, setIsNew] = useState(false);
  const items = allItems(menu);
  const usage = (id: string) => items.filter((i) => i.groupIds.includes(id)).length;

  const save = (g: OptionGroup) => {
    update((m) => ({ ...m, groups: m.groups.some((x) => x.id === g.id) ? m.groups.map((x) => (x.id === g.id ? g : x)) : [...m.groups, g] }));
    setEditing(null);
  };

  const remove = async (g: OptionGroup) => {
    const n = usage(g.id);
    if (!(await confirm({ title: `Excluir “${g.title}”?`, message: n ? `O grupo sai de ${n} ${n === 1 ? "produto" : "produtos"}.` : "Nenhum produto usa este grupo.", confirmLabel: "Excluir", danger: true }))) return;
    update((m) => ({
      ...m,
      groups: m.groups.filter((x) => x.id !== g.id),
      categories: m.categories.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i, groupIds: i.groupIds.filter((x) => x !== g.id) })) })),
    }));
  };

  const start = (g?: Omit<OptionGroup, "id">) => {
    setIsNew(true);
    setEditing({ id: uid("grp"), ...(g ?? { title: "", label: "", type: "multi", required: false, options: [{ name: "", price: 0 }] }) });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2rem]">Adicionais</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">Grupos de escolhas que o cliente faz ao pedir: ponto da carne, adicionais pagos, tamanho, sabor. Crie uma vez e use em vários produtos.</p>
        </div>
        {!readOnly && (
          <Button icon={<LuPlus className="size-4" />} onClick={() => start()}>
            Novo grupo
          </Button>
        )}
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted">Começar de um modelo:</span>
          {PRESETS.map((p) => (
            <button key={p.title} type="button" onClick={() => start(p.group)} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold hover:border-ink/30">
              {p.title}
            </button>
          ))}
        </div>
      )}

      {menu.groups.length === 0 ? (
        <div className="card">
          <EmptyState icon={<LuLayers className="size-6" />} title="Nenhum grupo de adicionais">
            Use um dos modelos acima ou crie um grupo do zero.
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {menu.groups.map((g) => (
            <div key={g.id} className="card flex flex-col p-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold">{g.title || "Sem título"}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge tone={g.required ? "info" : "neutral"}>{g.required ? "Obrigatório" : "Opcional"}</Badge>
                    <Badge tone="neutral">{g.type === "single" ? "Escolhe 1" : g.max ? `Até ${g.max}` : "Vários"}</Badge>
                    <Badge tone="neutral">
                      Em {usage(g.id)} {usage(g.id) === 1 ? "produto" : "produtos"}
                    </Badge>
                  </div>
                </div>
                {!readOnly && (
                  <div className="flex">
                    <IconButton
                      label="Editar"
                      onClick={() => {
                        setIsNew(false);
                        setEditing(g);
                      }}
                    >
                      <LuPencil className="size-4" />
                    </IconButton>
                    <IconButton label="Excluir" onClick={() => remove(g)} className="hover:bg-overdue-soft hover:text-overdue">
                      <LuTrash2 className="size-4" />
                    </IconButton>
                  </div>
                )}
              </div>
              <ul className="mt-4 space-y-1 text-sm">
                {g.options.map((o, i) => (
                  <li key={i} className="flex justify-between gap-3 border-b border-dashed border-line pb-1 last:border-0">
                    <span className="truncate">{o.name}</span>
                    <span className="shrink-0 text-muted tabular">{o.price ? `+ ${formatBRL(o.price)}` : "sem custo"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {editing && <GroupModal initial={editing} isNew={isNew} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function GroupModal({ initial, isNew, onClose, onSave }: { initial: OptionGroup; isNew: boolean; onClose: () => void; onSave: (g: OptionGroup) => void }) {
  const [g, setG] = useState<OptionGroup>({ ...initial, options: initial.options.map((o) => ({ ...o })) });
  const [error, setError] = useState("");
  const set = (patch: Partial<OptionGroup>) => {
    setG((x) => ({ ...x, ...patch }));
    setError("");
  };
  const setOpt = (i: number, patch: Partial<OptionGroup["options"][number]>) => set({ options: g.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const moveOpt = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= g.options.length) return;
    const next = [...g.options];
    [next[i], next[j]] = [next[j], next[i]];
    set({ options: next });
  };
  const submit = () => {
    const options = g.options.map((o) => ({ name: o.name.trim(), price: o.price })).filter((o) => o.name);
    if (g.title.trim().length < 2) return setError("Informe o título do grupo.");
    if (!options.length) return setError("Inclua pelo menos uma opção.");
    if (g.type === "multi" && g.max !== undefined && (g.max < 1 || g.max > 20)) return setError("O limite deve ficar entre 1 e 20.");
    onSave({ ...g, title: g.title.trim(), label: g.label.trim() || g.title.trim(), options, max: g.type === "multi" ? g.max : undefined });
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? "Novo grupo de adicionais" : g.title}
      footer={
        <>
          <ModalCloseButton />
          <Button onClick={submit}>{isNew ? "Criar grupo" : "Aplicar"}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Título para o cliente" htmlFor="g-title" required hint="Ex.: Turbine seu burger">
          <Input id="g-title" value={g.title} onChange={(e) => set({ title: e.target.value })} maxLength={40} data-autofocus />
        </Field>
        <Field label="Nome curto no pedido" htmlFor="g-label" hint="Aparece na mensagem do WhatsApp. Ex.: Adicional">
          <Input id="g-label" value={g.label} onChange={(e) => set({ label: e.target.value })} maxLength={20} placeholder={g.title} />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-2 text-[13px] font-semibold">Como o cliente escolhe</p>
          <Segmented
            label="Tipo de escolha"
            value={g.type}
            onChange={(type) => set({ type })}
            options={[
              { value: "single", label: "Escolhe uma opção" },
              { value: "multi", label: "Pode marcar várias" },
            ]}
          />
        </div>
        <Toggle checked={g.required} onChange={(required) => set({ required })} label="Obrigatório" hint="O cliente só adiciona à sacola depois de escolher" />
        {g.type === "multi" && (
          <Field label="Limite de escolhas" htmlFor="g-max" hint="Vazio = sem limite">
            <Input id="g-max" type="number" min={1} max={20} value={g.max ?? ""} onChange={(e) => set({ max: e.target.value ? Number(e.target.value) : undefined })} />
          </Field>
        )}
        <div className="sm:col-span-2">
          <p className="mb-2 text-[13px] font-semibold">Opções</p>
          <div className="space-y-2">
            {g.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={o.name} onChange={(e) => setOpt(i, { name: e.target.value })} placeholder="Nome da opção" maxLength={40} aria-label={`Opção ${i + 1}`} className="flex-1" />
                <div className="w-32 shrink-0">
                  <MoneyInput value={o.price} onChange={(v) => setOpt(i, { price: v ?? 0 })} />
                </div>
                <div className="hidden shrink-0 sm:flex">
                  <IconButton label="Subir" disabled={i === 0} onClick={() => moveOpt(i, -1)}>
                    <LuArrowUp className="size-4" />
                  </IconButton>
                  <IconButton label="Descer" disabled={i === g.options.length - 1} onClick={() => moveOpt(i, 1)}>
                    <LuArrowDown className="size-4" />
                  </IconButton>
                </div>
                <IconButton label="Remover opção" onClick={() => set({ options: g.options.filter((_, j) => j !== i) })}>
                  <LuX className="size-4" />
                </IconButton>
              </div>
            ))}
          </div>
          <Button size="sm" variant="soft" className="mt-3" icon={<LuPlus className="size-4" />} onClick={() => set({ options: [...g.options, { name: "", price: 0 }] })}>
            Adicionar opção
          </Button>
          <p className="mt-2 text-xs text-muted">Preço 0 = sem custo extra.</p>
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-overdue-soft px-3 py-2 text-sm font-medium text-overdue sm:col-span-2">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
