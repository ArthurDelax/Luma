"use client";

import { useMemo } from "react";
import { LocalMenuRepo } from "@/lib/menu/repo";
import { sampleMenu } from "@/lib/menu/sample";
import { BASE_PATH, href } from "@/lib/paths";
import { MenuEditor } from "./editor/MenuEditor";

/** Painel da loja com a Brasa Burger de exemplo; as alterações ficam só neste navegador. */
export function DemoPanel() {
  const repo = useMemo(() => new LocalMenuRepo(() => ({ slug: "brasa-burger", published: true, data: sampleMenu(BASE_PATH) })), []);
  return (
    <MenuEditor
      repo={repo}
      orgName="Brasa Burger & Co."
      publicUrl={() => `${typeof window !== "undefined" ? window.location.origin : ""}${href("/demo/")}`}
      session={{
        kind: "demo",
        banner: (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-ink px-4 py-2 text-center text-[13px] text-paper/80">
            <span>Demonstração com a loja de exemplo. Edite à vontade: nada é enviado.</span>
            <button
              type="button"
              className="font-semibold text-paper underline underline-offset-2"
              onClick={() => {
                LocalMenuRepo.reset();
                window.location.reload();
              }}
            >
              Restaurar o exemplo
            </button>
            <a href={href("/planos/")} className="font-semibold text-paper underline underline-offset-2">
              Quero para a minha loja
            </a>
          </div>
        ),
      }}
    />
  );
}
