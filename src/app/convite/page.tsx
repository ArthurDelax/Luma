import type { Metadata } from "next";
import { InviteAccept } from "@/components/admin/InviteAccept";

export const metadata: Metadata = { title: "Ativar acesso", robots: { index: false, follow: false } };

export default function ConvitePage() {
  return <InviteAccept />;
}
