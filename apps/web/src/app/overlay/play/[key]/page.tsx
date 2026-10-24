import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarbleOverlay } from "@/features/creatorStudio/play/MarbleOverlay";
import { getMarbleOverlay } from "@/services/play/marble";

// Code-first (no Figma frame): OBS browser-source overlay for 시청자 참여 게임 (?marble: 마블 룰렛, the only one so far).
export const metadata: Metadata = { title: "시청자 참여 게임", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const data = await getMarbleOverlay(key);
  // An invalid key looks like a missing page.
  if (data === "FORBIDDEN") notFound();
  return <MarbleOverlay data={data} />;
}
