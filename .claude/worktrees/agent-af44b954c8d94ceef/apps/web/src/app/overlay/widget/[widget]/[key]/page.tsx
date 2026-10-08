import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WidgetOverlay } from "@/features/creatorStudio/widgets/WidgetOverlay";
import { getOverlayWidget } from "@/services/creator/widgetOverlay";

// Code-first (no Figma frame): OBS browser-source overlays for 후원 위젯 (목표 · 누적 · 랭킹 · 최근알림 · 이벤트 · QR).
export const metadata: Metadata = { title: "후원 위젯 오버레이", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ widget: string; key: string }> }) {
  const { widget, key } = await params;
  const data = await getOverlayWidget(widget, key);
  // An invalid key or widget looks like a missing page.
  if (data === "FORBIDDEN") notFound();
  return <WidgetOverlay data={data} />;
}
