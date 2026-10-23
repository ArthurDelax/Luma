import type { Metadata } from "next";
import { Footer, Header, PlansSection } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Planos",
  description: "Cardápio digital Luma: R$ 99,90 por mês por loja, com até 2 pessoas no painel e sem comissão por pedido.",
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
