import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WidgetOverlay } from "@/features/creatorStudio/widgets/WidgetOverlay";
import { getOverlayWidget } from "@/services/creator/widgetOverlay";
import { isVertical } from "@/services/creator/overlayThemeTypes";

// Code-first (no Figma frame): OBS browser-source overlays for 후원 위젯 (목표 · 누적 · 랭킹 · 최근알림 · 이벤트 · QR · 게임 · 벽지 · 시계 · 미니후원 · 알림 모니터 · 시그 벽지).
export const metadata: Metadata = { title: "후원 위젯 오버레이", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ widget: string; key: string }>; searchParams: Promise<{ layout?: string; d?: string }> }) {
  const [{ widget, key }, { layout, d }] = await Promise.all([params, searchParams]);
  // ?d=: the donation a 시그 벽지 shows.
  const data = await getOverlayWidget(widget, key, d);
  // An invalid key or widget looks like a missing page.
  if (data === "FORBIDDEN") notFound();
  // ?layout=vertical: 세로 방송 (the 후원목표).
  return <WidgetOverlay data={data} vertical={isVertical(layout)} />;
}
