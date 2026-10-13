import type { Metadata } from "next";
import { CompanyApp } from "@/components/app/CompanyApp";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };

export default function EmpresaPage() {
  return <CompanyApp />;
}
