import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CrewScoreOverlay } from "@/features/creatorStudio/crew/CrewScoreOverlay";
import { getOverlayScoreboard } from "@/services/crew/crewBroadcast";

// Code-first (no Figma frame): OBS browser-source overlay for the crew scoreboard.
export const metadata: Metadata = { title: "크루 점수판", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const data = await getOverlayScoreboard((await params).key);
  // An invalid key looks like a missing page (no hint that the URL format is right).
  if (data === "FORBIDDEN") notFound();
  return <CrewScoreOverlay data={data === "IDLE" ? null : data} />;
}
