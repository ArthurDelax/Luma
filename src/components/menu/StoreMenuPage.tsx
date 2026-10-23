"use client";

import { useEffect, useState } from "react";
import { fetchPublicMenu } from "@/lib/menu/repo";
import type { MenuRecord } from "@/lib/menu/types";
import { href } from "@/lib/paths";
import { supabaseConfigured } from "@/lib/supabase";
import { PublicMenu } from "./PublicMenu";
import "./public-menu.css";

type State = { kind: "loading" } | { kind: "ok"; rec: MenuRecord } | { kind: "missing" } | { kind: "error"; message: string };

/** Cardápio público de uma loja: /c/?l=endereco-da-loja */
export function StoreMenuPage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [slug, setSlug] = useState("");

  useEffect(() => {
    const l = (new URLSearchParams(window.location.search).get("l") ?? "").trim().toLowerCase();
    setSlug(l);
    if (!l || !supabaseConfigured()) return setState({ kind: "missing" });
    let alive = true;
    const load = () =>
      fetchPublicMenu(l)
        .then((rec) => {
          if (!alive) return;
          if (!rec) return setState({ kind: "missing" });
          document.title = `${rec.data.store.name} · Cardápio`;
          setState({ kind: "ok", rec });
        })
        .catch((e) => alive && setState({ kind: "error", message: e instanceof Error ? e.message : "Não foi possível abrir o cardápio." }));
    void load();
    return () => {
      alive = false;
    };
  }, []);

  if (state.kind === "ok") return <PublicMenu menu={state.rec.data} slug={slug} />;

  return (
    <div className="cm-state">
      {state.kind === "loading" ? (
        <p style={{ color: "#857a6d" }}>Abrindo o cardápio…</p>
      ) : state.kind === "missing" ? (
        <div>
          <h1>Cardápio indisponível</h1>
          <p>Este endereço não existe ou a loja está com o cardápio fora do ar no momento. Confira o link com a loja.</p>
          <p style={{ marginTop: 18 }}>
            <a href={href("/")} style={{ fontWeight: 700, color: "#1c1712" }}>
              Conheça a Luma
            </a>
          </p>
        </div>
      ) : (
        <div>
          <h1>Não foi possível abrir</h1>
          <p>{state.message}</p>
          <p style={{ marginTop: 18 }}>
            <button type="button" onClick={() => window.location.reload()} style={{ fontWeight: 700, textDecoration: "underline" }}>
              Tentar de novo
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
