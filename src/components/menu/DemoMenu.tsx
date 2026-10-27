"use client";

import { useEffect, useMemo, useState } from "react";
import { tableFromLocation } from "@/lib/menu/links";
import { sampleMenu } from "@/lib/menu/sample";
import { BASE_PATH, href } from "@/lib/paths";
import { PublicMenu } from "./PublicMenu";

/** Cardápio de exemplo (Brasa Burger) com o aviso de que é uma demonstração. */
export function DemoMenu() {
  const [table, setTable] = useState<string | undefined>();
  // ?foto=1: sem o aviso de exemplo e com a loja aberta (capturas de tela para divulgação)
  const [clean, setClean] = useState(false);
  const menu = useMemo(() => {
    const m = sampleMenu(BASE_PATH);
    return clean ? { ...m, store: { ...m.store, heroClips: [], hours: m.store.hours.map((): [string, string] => ["08:00", "23:30"]) } } : m;
  }, [clean]);
  useEffect(() => {
    setTable(tableFromLocation(window.location.search));
    setClean(new URLSearchParams(window.location.search).has("foto"));
  }, []);
  return (
    <PublicMenu
      menu={menu}
      slug="demo-brasa"
      table={table}
      notice={
        clean ? undefined : (
          <span className="flex items-center gap-3">
            Exemplo: o pedido abre o WhatsApp de um número fictício
            <a href={href("/planos/")} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#1c1712]">
              Quero um assim
            </a>
          </span>
        )
      }
    />
  );
}
