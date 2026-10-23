import { href } from "../paths.ts";

/** Link público do cardápio de uma loja (ex.: https://gestãoluma.com.br/c/?l=brasa-burger). */
export function menuUrl(slug: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${href("/c/")}?l=${encodeURIComponent(slug)}`;
}
