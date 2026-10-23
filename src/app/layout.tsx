import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Poppins } from "next/font/google";
import "./globals.css";

// Fontes baixadas no build e servidas pelo próprio site: abre mais rápido e sem "piscar".
const instrument = Instrument_Sans({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-instrument" });
const poppins = Poppins({ subsets: ["latin", "latin-ext"], weight: ["500", "600", "700"], display: "swap", variable: "--font-poppins" });

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: { default: "Luma — Cardápio digital com pedido no WhatsApp", template: "%s · Luma" },
  description:
    "Cardápio digital para hamburguerias, pizzarias, lanchonetes e restaurantes: fotos, adicionais, entrega ou retirada e o pedido pronto no WhatsApp da loja, sem comissão.",
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
