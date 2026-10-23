import type { Metadata } from "next";
import { DemoMenu } from "@/components/menu/DemoMenu";

export const metadata: Metadata = {
  title: { absolute: "Brasa Burger & Co. · Cardápio digital (exemplo)" },
  description: "Exemplo de cardápio digital feito na Luma: entrega ou retirada e pedido direto no WhatsApp.",
};

export default function DemoPage() {
  return <DemoMenu />;
}
