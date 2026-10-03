import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BattleOverlay, CrewScoreOverlay, ScenarioOverlay, StealOverlay, SubBoardOverlay } from "@/features/creatorStudio/crew/CrewScoreOverlay";
import { getOverlaySignal } from "@/services/creator/alertRemote";
import { getOverlayScoreboard } from "@/services/crew/crewBroadcast";

// Code-first (no Figma frame): OBS browser-source overlay for the crew scoreboard.
export const metadata: Metadata = { title: "크루 점수판", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ board?: string; battle?: string; steal?: string; scenario?: string }> }) {
  const [{ key }, { board, battle, steal, scenario }] = await Promise.all([params, searchParams]);
  const [data, signal] = await Promise.all([getOverlayScoreboard(key), getOverlaySignal(key, "crew")]);
  // An invalid key looks like a missing page (no hint that the URL format is right).
  if (data === "FORBIDDEN" || signal === "FORBIDDEN") notFound();
  const { reloadSeq } = signal;
  // 리모컨 기능 제어 OFF: every crew view shows nothing (it keeps polling, so ON brings it back).
  const live = data === "IDLE" || !signal.on ? null : data;
  // ?board=번호 shows that 서브 점수판 instead of the main board (nothing until it exists).
  if (board !== undefined) return <SubBoardOverlay board={live?.subBoards.find((s) => String(s.no) === board) ?? null} reloadSeq={reloadSeq} />;
  // ?scenario shows the running 콘텐츠 시나리오 part.
  if (scenario !== undefined) return <ScenarioOverlay scenario={live?.scenario ?? null} reloadSeq={reloadSeq} />;
  // ?steal shows the latest 기여도 강탈 spin for a few seconds.
  if (steal !== undefined) return <StealOverlay latest={live?.steals[0] ?? null} reloadSeq={reloadSeq} />;
  // ?battle shows the running 실시간 배틀 (or the last result) instead.
  if (battle !== undefined) return <BattleOverlay battle={live?.battles.find((b) => b.running) ?? live?.battles.at(-1) ?? null} reloadSeq={reloadSeq} />;
  return <CrewScoreOverlay data={live} reloadSeq={reloadSeq} />;
}
