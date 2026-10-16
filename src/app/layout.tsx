import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Poppins } from "next/font/google";
import "./globals.css";

// Fontes baixadas no build e servidas pelo próprio site: abre mais rápido e sem "piscar".
const instrument = Instrument_Sans({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-instrument" });
const poppins = Poppins({ subsets: ["latin", "latin-ext"], weight: ["500", "600", "700"], display: "swap", variable: "--font-poppins" });

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: { default: "Luma — Sua empresa. Tudo sob controle.", template: "%s · Luma" },
  description:
    "Luma organiza contas a pagar, boletos, despesas recorrentes, contratos e documentos da sua empresa, com alertas de vencimento e relatórios. Versão demonstrativa.",
  icons: { icon: `${base}/icon.svg` },
};

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${instrument.variable} ${poppins.variable}`}>
      <body>{children}</body>
    </html>
  );
}
