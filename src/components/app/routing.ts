"use client";

import { useEffect, useState } from "react";

/**
 * Navegação interna por hash (#/contas, #/calendario…).
 * Funciona em hospedagem estática como o GitHub Pages sem configurar
 * redirecionamentos, e recarregar a página mantém a tela atual.
 */
export type RouteId = "painel" | "contas" | "recorrentes" | "documentos" | "alertas" | "calendario" | "relatorios" | "ajustes";

export const ROUTES: RouteId[] = ["painel", "contas", "recorrentes", "documentos", "alertas", "calendario", "relatorios", "ajustes"];

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

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>({ id: "painel", params: new URLSearchParams() });
  useEffect(() => {
    const update = () => {
      setRoute(parse(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return route;
}

export function navigate(id: RouteId, params?: Record<string, string>) {
  const q = params ? `?${new URLSearchParams(params).toString()}` : "";
  window.location.hash = `#/${id}${q}`;
}
