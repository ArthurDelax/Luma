"use client";

import { useEffect, useRef } from "react";

/**
 * Executa `fn` agora e depois a cada `ms` milissegundos — o "ao vivo" do suporte.
 *
 * - A função fica guardada numa ref: trocar a função não reinicia o relógio.
 * - Com a aba escondida, pausa (economiza chamadas ao banco); ao voltar para a
 *   aba ou ao focar a janela, atualiza na hora.
 * - Nunca roda duas vezes ao mesmo tempo (se o banco demorar, espera terminar).
 * - `enabled = false` desliga tudo.
 */
export function usePolling(fn: () => Promise<unknown> | void, ms: number, enabled = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let running = false;
    let stopped = false;
    const tick = async () => {
      if (running || stopped) return;
      running = true;
      try {
        await fnRef.current();
      } catch {
        /* quem chama trata os próprios erros */
      } finally {
        running = false;
      }
    };
    const visible = () => typeof document === "undefined" || document.visibilityState !== "hidden";

    void tick();
    const t = setInterval(() => {
      if (visible()) void tick();
    }, ms);
    const wake = () => {
      if (visible()) void tick();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    return () => {
      stopped = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
    };
  }, [ms, enabled]);
}
