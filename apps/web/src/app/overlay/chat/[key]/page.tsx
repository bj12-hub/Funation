import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatOverlay } from "@/features/broadcast/ChatOverlay";
import { getChatOverlay } from "@/services/broadcast/unifiedChat";
import { getOverlaySignal } from "@/services/creator/alertRemote";
import { isVertical } from "@/services/creator/overlayThemeTypes";

// Code-first (no Figma frame): OBS browser-source overlay for 통합 채팅.
export const metadata: Metadata = { title: "통합 채팅 오버레이", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ layout?: string }> }) {
  const [{ key }, { layout }] = await Promise.all([params, searchParams]);
  const [view, signal] = await Promise.all([getChatOverlay(key), getOverlaySignal(key, "chat")]);
  // An invalid key looks like a missing page.
  if (view === "FORBIDDEN" || signal === "FORBIDDEN") notFound();
  // ?layout=vertical: 세로 방송 (mobile streaming apps).
  return <ChatOverlay overlayKey={key} initial={view} initialSignal={signal} vertical={isVertical(layout)} />;
}
