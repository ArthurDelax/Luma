import { href } from "../paths.ts";

/** Link público do cardápio de uma loja (ex.: https://gestãoluma.com.br/c/?l=brasa-burger). */
export function menuUrl(slug: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${href("/c/")}?l=${encodeURIComponent(slug)}`;
}

/** Mesmo link com o número da mesa (QR Code colado na mesa). */
export function tableUrl(url: string, table: number | string): string {
  return `${url}${url.includes("?") ? "&" : "?"}mesa=${encodeURIComponent(String(table))}`;
}

/** Número da mesa lido do endereço (?mesa=5), ou undefined. */
export function tableFromLocation(search: string): string | undefined {
  const m = new URLSearchParams(search).get("mesa")?.trim();
  return m && /^[\w-]{1,10}$/.test(m) ? m : undefined;
}
