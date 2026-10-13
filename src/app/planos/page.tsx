import type { Metadata } from "next";
import { Footer, Header, PlansSection } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Planos",
  description: "Luma: R$ 99,90 por mês para até 2 usuários e R$ 29,90 por usuário adicional, até 10 usuários.",
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
