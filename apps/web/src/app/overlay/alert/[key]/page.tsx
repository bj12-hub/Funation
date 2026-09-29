import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertOverlay } from "@/features/creatorStudio/remote/AlertOverlay";
import { getOverlayAlert } from "@/services/creator/alertRemote";

// Code-first (no Figma frame): OBS browser-source overlay for donation alerts.
export const metadata: Metadata = { title: "후원 알림 오버레이", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const data = await getOverlayAlert((await params).key);
  // An invalid key looks like a missing page.
  if (data === "FORBIDDEN") notFound();
  return <AlertOverlay data={data} />;
}
