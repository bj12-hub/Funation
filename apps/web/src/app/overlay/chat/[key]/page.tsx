import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatOverlay } from "@/features/broadcast/ChatOverlay";
import { getChatOverlay } from "@/services/broadcast/unifiedChat";
import { getOverlaySignal } from "@/services/creator/alertRemote";

// Code-first (no Figma frame): OBS browser-source overlay for 통합 채팅.
export const metadata: Metadata = { title: "통합 채팅 오버레이", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const key = (await params).key;
  const [view, signal] = await Promise.all([getChatOverlay(key), getOverlaySignal(key, "chat")]);
  // An invalid key looks like a missing page.
  if (view === "FORBIDDEN" || signal === "FORBIDDEN") notFound();
  return <ChatOverlay overlayKey={key} initial={view} initialSignal={signal} />;
}
