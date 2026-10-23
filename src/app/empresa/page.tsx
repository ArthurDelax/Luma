import type { Metadata } from "next";
import { StoreArea } from "@/components/store/StoreArea";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };

export default function EmpresaPage() {
  return <StoreArea />;
}
