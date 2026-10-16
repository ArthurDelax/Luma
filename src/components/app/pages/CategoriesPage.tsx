"use client";

import { useMemo, useState, type FormEvent } from "react";
import { LuPencil, LuPlus, LuTags, LuTrash2 } from "react-icons/lu";
import { CATEGORIES, categoryNameError } from "@/lib/domain";
import { useStore } from "@/lib/store";
import type { CustomCategory } from "@/lib/types";
import { ModalCloseButton, Badge, Button, EmptyState, Field, IconButton, Input, Modal, PageHeader, useConfirm, useToast } from "../../ui";

function CategoryForm({ initial, onClose }: { initial: Partial<CustomCategory>; onClose: () => void }) {
  const { data, addCategory, renameCategory, requireWrite } = useStore();
  const toast = useToast();
  const [name, setName] = useState(initial.name ?? "");
  const [error, setError] = useState("");
  const used = initial.name ? data.bills.filter((b) => b.category === initial.name).length + data.recurring.filter((r) => r.category === initial.name).length : 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!requireWrite()) return;
    const err = categoryNameError(name, data.categories ?? [], initial.id);
    if (err) return setError(err);
    if (initial.id) {
      renameCategory(initial.id, name);
      toast("success", "Categoria atualizada.");
    } else {
      addCategory(name);
      toast("success", "Categoria cadastrada.");
    }
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={initial.id ? "Editar categoria" : "Nova categoria"}
      footer={
        <>
          <ModalCloseButton>
            Cancelar
          </ModalCloseButton>
          <Button type="submit" form="cat-form">
            {initial.id ? "Salvar alterações" : "Cadastrar categoria"}
          </Button>
        </>
      }
    >
      <form id="cat-form" onSubmit={submit} noValidate className="space-y-3">
        <Field label="Nome da categoria" htmlFor="cat-name" required error={error}>
          <Input
            id="cat-name"
            value={name}
            maxLength={60}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            placeholder="Ex.: Combustível, Frete, Material de limpeza"
            invalid={!!error}
            data-autofocus
          />
        </Field>
        {used > 0 && (
          <p className="text-xs text-muted">
            {used} {used === 1 ? "lançamento usa" : "lançamentos usam"} esta categoria e {used === 1 ? "será atualizado" : "serão atualizados"} com o novo nome.
          </p>
        )}
      </form>
    </Modal>
  );
}

export function CategoriesPage() {
  const { data, deleteCategory, requireWrite } = useStore();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState<Partial<CustomCategory> | null>(null);

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of data.bills) m.set(b.category, (m.get(b.category) ?? 0) + 1);
    for (const r of data.recurring) m.set(r.category, (m.get(r.category) ?? 0) + 1);
    return m;
  }, [data.bills, data.recurring]);

  const own = useMemo(() => [...(data.categories ?? [])].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [data.categories]);

  const openEditor = (c: Partial<CustomCategory>) => {
    if (requireWrite()) setEditing(c);
  };

  const remove = async (c: CustomCategory) => {
    if (!requireWrite()) return;
    const used = usage.get(c.name) ?? 0;
    if (used > 0) {
      await confirm({
        title: "Categoria em uso",
        message: (
          <>
            <strong>{c.name}</strong> está em {used} {used === 1 ? "lançamento" : "lançamentos"} (contas ou despesas recorrentes). Altere a categoria desses lançamentos antes de excluir, ou renomeie esta categoria.
          </>
        ),
        confirmLabel: "Entendi",
      });
      return;
    }
    const ok = await confirm({
      title: "Excluir categoria?",
      message: (
        <>
          <strong>{c.name}</strong> deixará de aparecer na lista de categorias.
        </>
      ),
      confirmLabel: "Excluir categoria",
      danger: true,
    });
    if (ok) {
      deleteCategory(c.id);
      toast("success", "Categoria excluída.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Categorias"
        description="Organize suas contas e despesas recorrentes com categorias próprias, além das categorias padrão da Luma."
        actions={
          <Button icon={<LuPlus className="size-4" />} onClick={() => openEditor({})}>
            Nova categoria
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <section className="card overflow-hidden">
          <h2 className="px-5 pb-3 pt-5 font-display text-base font-semibold">Suas categorias</h2>
          {own.length === 0 ? (
            <EmptyState icon={<LuTags className="size-6" />} title="Nenhuma categoria própria" action={<Button onClick={() => openEditor({})}>Cadastrar categoria</Button>}>
              Crie categorias como &quot;Combustível&quot;, &quot;Frete&quot; ou &quot;Material de limpeza&quot; para separar melhor seus gastos.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {own.map((c) => {
                const used = usage.get(c.name) ?? 0;
                return (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{c.name}</p>
                      <p className="text-xs text-muted">{used === 0 ? "Sem lançamentos" : `${used} ${used === 1 ? "lançamento" : "lançamentos"}`}</p>
                    </div>
                    <div className="flex gap-0.5">
                      <IconButton label="Editar" onClick={() => openEditor(c)}>
                        <LuPencil className="size-4" />
                      </IconButton>
                      <IconButton label="Excluir" onClick={() => remove(c)} className="hover:!bg-overdue-soft hover:!text-overdue">
                        <LuTrash2 className="size-4" />
                      </IconButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <h2 className="px-5 pb-1 pt-5 font-display text-base font-semibold">Categorias padrão</h2>
          <p className="px-5 pb-3 text-xs text-muted">Sempre disponíveis para todas as empresas.</p>
          <div className="flex flex-wrap gap-2 px-5 pb-5">
            {CATEGORIES.map((c) => (
              <Badge key={c} tone="neutral">
                {c}
              </Badge>
            ))}
          </div>
        </section>
      </div>

      {editing && <CategoryForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
