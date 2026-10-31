import type { Metadata } from "next";
import { RumbleLiveController } from "@/features/play/RumbleLiveController";
import { getT } from "@/lib/i18n/server";
import { getLiveInvite } from "@/services/play/rumbleLive";

// Code-first (no Figma frame): 로얄 럼블 (조작형) 참가 · 조종 — no login; the token in the link is the secret.
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("play.metaRumble"), robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <RumbleLiveController token={token} invite={await getLiveInvite(token)} />;
}
