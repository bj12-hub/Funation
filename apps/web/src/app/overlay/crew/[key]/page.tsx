import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CrewScoreOverlay, SubBoardOverlay } from "@/features/creatorStudio/crew/CrewScoreOverlay";
import { getOverlayScoreboard } from "@/services/crew/crewBroadcast";

// Code-first (no Figma frame): OBS browser-source overlay for the crew scoreboard.
export const metadata: Metadata = { title: "크루 점수판", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ board?: string }> }) {
  const [{ key }, { board }] = await Promise.all([params, searchParams]);
  const data = await getOverlayScoreboard(key);
  // An invalid key looks like a missing page (no hint that the URL format is right).
  if (data === "FORBIDDEN") notFound();
  const live = data === "IDLE" ? null : data;
  // ?board=번호 shows that 서브 점수판 instead of the main board (nothing until it exists).
  if (board !== undefined) return <SubBoardOverlay board={live?.subBoards.find((s) => String(s.no) === board) ?? null} />;
  return <CrewScoreOverlay data={live} />;
}
