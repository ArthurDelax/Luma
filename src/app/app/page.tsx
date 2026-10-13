import type { Metadata } from "next";
import { LumaApp } from "@/components/app/LumaApp";

export const metadata: Metadata = { title: "Painel" };

export default function AppPage() {
  return <LumaApp />;
}
