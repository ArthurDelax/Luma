"use client";

import { LuLock, LuSparkles } from "react-icons/lu";
import { DEMO_BLOCKED_MESSAGE } from "@/lib/demo";
import { href } from "@/lib/paths";
import { useStore } from "@/lib/store";
import { LogoMark, Modal } from "../ui";

/** Aviso exibido quando alguém tenta alterar dados na demonstração. */
export function DemoBlockedDialog() {
  const { blockedAt, dismissBlocked } = useStore();
  return (
    <Modal open={blockedAt !== null} onClose={dismissBlocked} size="sm" title="Recurso para assinantes">
      <div className="flex flex-col items-center text-center">
        <div className="dot-grid relative grid size-20 place-items-center rounded-full border border-line bg-paper">
          <LogoMark className="size-9" />
          <span className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-ink text-paper ring-4 ring-white">
            <LuLock className="size-4" />
          </span>
        </div>
        <p className="mt-5 font-display text-lg font-semibold leading-snug">{DEMO_BLOCKED_MESSAGE}</p>
        <p className="mt-2 text-sm text-muted">Na demonstração você pode navegar, pesquisar, filtrar e exportar à vontade. Cadastrar, editar e excluir faz parte dos planos.</p>
        <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row-reverse">
          <a href={href("/planos/")} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-paper transition-colors hover:bg-navy-700" data-autofocus>
            <LuSparkles className="size-4" />
            Conhecer planos
          </a>
          <button type="button" onClick={dismissBlocked} className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-line px-5 text-sm font-semibold text-ink hover:border-ink/30">
            Continuar explorando
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Faixa no topo do painel lembrando que é uma demonstração. */
export function DemoBanner() {
  const { readOnly } = useStore();
  if (!readOnly) return null;
  return (
    <div className="no-print flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-ink px-4 py-2 text-center text-[13px] text-paper/80">
      <span>
        <strong className="font-semibold text-paper">Demonstração</strong> com dados fictícios — alterações desativadas.
      </span>
      <a href={href("/planos/")} className="font-semibold text-paper underline underline-offset-2 hover:no-underline">
        Conhecer planos
      </a>
    </div>
  );
}
