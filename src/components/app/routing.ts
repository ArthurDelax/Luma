"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

/**
 * Navegação interna por hash (#/contas, #/calendario…).
 * Funciona em hospedagem estática como o GitHub Pages sem configurar
 * redirecionamentos, e recarregar a página mantém a tela atual.
 */
export type RouteId = "painel" | "caixa" | "contas" | "receber" | "recorrentes" | "categorias" | "documentos" | "alertas" | "calendario" | "relatorios" | "ajustes";

export const ROUTES: RouteId[] = ["painel", "caixa", "contas", "receber", "recorrentes", "categorias", "documentos", "alertas", "calendario", "relatorios", "ajustes"];

export interface Route {
  id: RouteId;
  params: URLSearchParams;
}

function parse(hash: string): Route {
  const clean = hash.replace(/^#\/?/, "");
  const [path, query = ""] = clean.split("?");
  const id = (ROUTES as string[]).includes(path) ? (path as RouteId) : "painel";
  return { id, params: new URLSearchParams(query) };
}

/** Ordem das abas (igual à barra de baixo e ao menu): define se a tela entra pela direita ou pela esquerda. */
const TAB_ORDER: RouteId[] = ["painel", "caixa", "contas", "receber", "recorrentes", "categorias", "documentos", "calendario", "alertas", "relatorios", "ajustes"];

type StartViewTransition = (cb: () => void) => unknown;

/** Transição nativa entre telas, quando o navegador tem (Chrome/Android, Safari 18+). */
function viewTransition(): StartViewTransition | undefined {
  const fn = (document as unknown as { startViewTransition?: unknown }).startViewTransition;
  return typeof fn === "function" ? (fn.bind(document) as StartViewTransition) : undefined;
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>({ id: "painel", params: new URLSearchParams() });
  const current = useRef<RouteId>("painel");
  useEffect(() => {
    if (viewTransition()) document.documentElement.classList.add("vt");

    const apply = (next: Route) => {
      current.current = next.id;
      setRoute(next);
      window.scrollTo({ top: 0 });
    };
    const update = (first = false) => {
      const next = parse(window.location.hash);
      const from = current.current;
      if (first || next.id === from) return apply(next);
      // direção: aba "depois" entra pela direita, aba "antes" entra pela esquerda
      document.documentElement.dataset.navDir = TAB_ORDER.indexOf(next.id) >= TAB_ORDER.indexOf(from) ? "forward" : "back";
      const start = viewTransition();
      if (start) {
        start(() => flushSync(() => apply(next)));
      } else {
        apply(next);
      }
    };
    update(true);
    const onHash = () => update();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

export function navigate(id: RouteId, params?: Record<string, string>) {
  const q = params ? `?${new URLSearchParams(params).toString()}` : "";
  window.location.hash = `#/${id}${q}`;
}
