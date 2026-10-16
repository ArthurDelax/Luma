"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

/**
 * Navegação interna por hash (#/contas, #/calendario…).
 * Funciona em hospedagem estática como o GitHub Pages sem configurar
 * redirecionamentos, e recarregar a página mantém a tela atual.
 */
export type RouteId = "painel" | "contas" | "recorrentes" | "categorias" | "documentos" | "alertas" | "calendario" | "relatorios" | "ajustes";

export const ROUTES: RouteId[] = ["painel", "contas", "recorrentes", "categorias", "documentos", "alertas", "calendario", "relatorios", "ajustes"];

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
const TAB_ORDER: RouteId[] = ["painel", "contas", "recorrentes", "categorias", "documentos", "calendario", "alertas", "relatorios", "ajustes"];

type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => unknown };

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>({ id: "painel", params: new URLSearchParams() });
  const current = useRef<RouteId>("painel");
  useEffect(() => {
    const doc = document as ViewTransitionDoc;
    // navegadores com transição nativa entre telas (Chrome/Android, Safari 18+)
    if (doc.startViewTransition && !reducedMotion()) document.documentElement.classList.add("vt");

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
      if (doc.startViewTransition && !reducedMotion()) {
        doc.startViewTransition(() => flushSync(() => apply(next)));
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
