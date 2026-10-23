"use client";

import { useMemo } from "react";
import { sampleMenu } from "@/lib/menu/sample";
import { BASE_PATH, href } from "@/lib/paths";
import { PublicMenu } from "./PublicMenu";

/** Cardápio de exemplo (Brasa Burger) com o aviso de que é uma demonstração. */
export function DemoMenu() {
  const menu = useMemo(() => sampleMenu(BASE_PATH), []);
  return (
    <PublicMenu
      menu={menu}
      slug="demo-brasa"
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
