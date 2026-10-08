import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertOverlay } from "@/features/creatorStudio/remote/AlertOverlay";
import { getOverlayAlert } from "@/services/creator/alertRemote";
import { isVertical } from "@/services/creator/overlayThemeTypes";

// Code-first (no Figma frame): OBS browser-source overlay for donation alerts.
export const metadata: Metadata = { title: "후원 알림 오버레이", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ layout?: string }> }) {
  const [{ key }, { layout }] = await Promise.all([params, searchParams]);
  const data = await getOverlayAlert(key);
  // An invalid key looks like a missing page.
  if (data === "FORBIDDEN") notFound();
  // ?layout=vertical: 세로 방송 (mobile streaming apps).
  return <AlertOverlay data={data} vertical={isVertical(layout)} />;
}
