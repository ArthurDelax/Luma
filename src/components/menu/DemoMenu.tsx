"use client";

import { useEffect, useMemo, useState } from "react";
import { tableFromLocation } from "@/lib/menu/links";
import { sampleMenu } from "@/lib/menu/sample";
import { BASE_PATH, href } from "@/lib/paths";
import { PublicMenu } from "./PublicMenu";

/** Cardápio de exemplo (Brasa Burger) com o aviso de que é uma demonstração. */
export function DemoMenu() {
  const menu = useMemo(() => sampleMenu(BASE_PATH), []);
  const [table, setTable] = useState<string | undefined>();
  useEffect(() => setTable(tableFromLocation(window.location.search)), []);
  return (
    <PublicMenu
      menu={menu}
      slug="demo-brasa"
      table={table}
      notice={
        <span className="flex items-center gap-3">
          Exemplo: o pedido abre o WhatsApp de um número fictício
          <a href={href("/planos/")} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#1c1712]">
            Quero um assim
          </a>
        </span>
      }
    />
  );
}
