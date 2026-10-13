/**
 * Configuração do Next.js para exportação estática (GitHub Pages).
 *
 * PAGES_BASE_PATH é definido pelo workflow do GitHub Actions (ex.: "/luma").
 * Localmente fica vazio, então o site roda em http://localhost:3000/.
 */
const basePath = process.env.PAGES_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    // A versão publicada no GitHub Pages é sempre a demonstração somente leitura.
    NEXT_PUBLIC_DEMO_MODE: process.env.DEMO_MODE ?? "true",
    NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.WHATSAPP_NUMBER ?? "",
  },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
