import type { Metadata } from "next";
import { MarbleInviteScreen } from "@/features/play/MarbleInviteScreen";
import { getT } from "@/lib/i18n/server";
import { getMarbleInvite } from "@/services/play/marble";

// Code-first (no Figma frame): 마블 룰렛 초대 링크 (VIP) — no login; the token in the link is the secret.
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("play.metaMarble"), robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <MarbleInviteScreen token={token} invite={await getMarbleInvite(token)} />;
}
