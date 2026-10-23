import type { Metadata } from "next";
import { StoreMenuPage } from "@/components/menu/StoreMenuPage";

export const metadata: Metadata = { title: { absolute: "Cardápio digital" }, description: "Veja o cardápio, monte o pedido e envie pelo WhatsApp." };

export default function CardapioPage() {
  return <StoreMenuPage />;
}
