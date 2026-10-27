import type { Metadata } from "next";
import { Footer, Header, PlansSection } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Planos",
  description: "Cardápio digital Luma: R$ 119,90 por mês por loja + implantação, ou plano anual com 2 meses grátis. Sem comissão por pedido.",
};

export default function PlanosPage() {
  return (
    <>
      <Header />
      <main>
        <PlansSection standalone />
      </main>
      <Footer />
    </>
  );
}
