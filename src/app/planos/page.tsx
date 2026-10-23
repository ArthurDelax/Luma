import type { Metadata } from "next";
import { Footer, Header, PlansSection } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Planos",
  description: "Cardápio digital Luma: plano único de R$ 119,90 por mês por loja, com tudo incluído e sem comissão por pedido.",
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
