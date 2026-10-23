import type { Metadata } from "next";
import { DemoPanel } from "@/components/menu/DemoPanel";

export const metadata: Metadata = { title: "Painel da loja (demonstração)" };

export default function AppPage() {
  return <DemoPanel />;
}
