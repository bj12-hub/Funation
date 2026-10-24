import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarbleOverlay } from "@/features/creatorStudio/play/MarbleOverlay";
import { RumbleLiveOverlay } from "@/features/creatorStudio/play/RumbleLiveOverlay";
import { RumbleOverlay } from "@/features/creatorStudio/play/RumbleOverlay";
import { getMarbleOverlay } from "@/services/play/marble";
import { getRumbleOverlay } from "@/services/play/rumble";
import { getLiveOverlay } from "@/services/play/rumbleLive";

// Code-first (no Figma frame): OBS browser-source overlay for 시청자 참여 게임 — ?rumble: 로얄 럼블, ?rumblelive: 로얄 럼블 (조작형),
// otherwise (?marble) 마블 룰렛.
export const metadata: Metadata = { title: "시청자 참여 게임", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ rumble?: string; rumblelive?: string }> }) {
  const [{ key }, { rumble, rumblelive }] = await Promise.all([params, searchParams]);
  if (rumblelive !== undefined) {
    const data = await getLiveOverlay(key);
    if (data === "FORBIDDEN") notFound();
    return <RumbleLiveOverlay overlayKey={key} initial={data.state} theme={data.theme} />;
  }
  if (rumble !== undefined) {
    const data = await getRumbleOverlay(key);
    // An invalid key looks like a missing page.
    if (data === "FORBIDDEN") notFound();
    return <RumbleOverlay data={data} />;
  }
  const data = await getMarbleOverlay(key);
  if (data === "FORBIDDEN") notFound();
  return <MarbleOverlay data={data} />;
}
