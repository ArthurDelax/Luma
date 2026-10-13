/**
 * Caminho base do site. No GitHub Pages o site fica em /luma; localmente fica vazio.
 * Definido em next.config.mjs a partir da variável PAGES_BASE_PATH.
 */
export const BASE_PATH: string = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function href(path: string): string {
  return `${BASE_PATH}${path}`;
}
