/**
 * Modo demonstração.
 *
 * A versão publicada no GitHub Pages é uma demonstração pública: os dados são
 * fictícios, ficam só na memória da página e qualquer alteração é bloqueada
 * pela camada de dados (StoreProvider) — não apenas escondendo botões.
 *
 * Para desenvolver localmente com edição liberada: DEMO_MODE=false npm run dev
 */
export const DEMO_MODE: boolean = (process.env.NEXT_PUBLIC_DEMO_MODE ?? "true") !== "false";

export const DEMO_BLOCKED_MESSAGE = "Esta funcionalidade está disponível para assinantes da Luma.";
