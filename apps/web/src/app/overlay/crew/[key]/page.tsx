import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BattleOverlay, CrewScoreOverlay, PrizeBoardOverlay, ScenarioOverlay, SigCountOverlay, StealOverlay, SubBoardOverlay } from "@/features/creatorStudio/crew/CrewScoreOverlay";
import { AlphabetOverlay } from "@/features/creatorStudio/crew/AlphabetOverlay";
import { DiceOverlay } from "@/features/creatorStudio/crew/DiceOverlay";
import { GoStopOverlay, GoStopTicker } from "@/features/creatorStudio/crew/GoStopOverlay";
import { GridDrawOverlay } from "@/features/creatorStudio/crew/GridDrawOverlay";
import { JupjupOverlay } from "@/features/creatorStudio/crew/JupjupOverlay";
import { MedleyOverlay } from "@/features/creatorStudio/crew/MedleyOverlay";
import { SigBingoOverlay } from "@/features/creatorStudio/crew/SigBingoOverlay";
import { SigDosanOverlay } from "@/features/creatorStudio/crew/SigDosanOverlay";
import { SigHunterOverlay } from "@/features/creatorStudio/crew/SigHunterOverlay";
import { RandomSigOverlay } from "@/features/creatorStudio/crew/RandomSigOverlay";
import { RelayOverlay } from "@/features/creatorStudio/crew/RelayOverlay";
import { SpinMachineOverlay, SpinTallyOverlay } from "@/features/creatorStudio/crew/SpinOverlay";
import { SudopolyOverlay } from "@/features/creatorStudio/crew/SudopolyOverlay";
import { TerritoryOverlay } from "@/features/creatorStudio/crew/TerritoryOverlay";
import { TwoWheelOverlay } from "@/features/creatorStudio/crew/TwoWheelOverlay";
import { getOverlaySignal } from "@/services/creator/alertRemote";
import { overlayTheme, readLook } from "@/services/creator/overlayThemeStore";
import { getOverlayScoreboard } from "@/services/crew/crewBroadcast";

// Code-first (no Figma frame): OBS browser-source overlay for the crew scoreboard.
export const metadata: Metadata = { title: "크루 점수판", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Views = { board?: string; battle?: string; steal?: string; scenario?: string; prize?: string; sigcount?: string; spin?: string; spintally?: string; dice?: string; twowheel?: string; randomsig?: string; relay?: string; jupjup?: string; medley?: string; sigbingo?: string; griddraw?: string; sighunter?: string; sigdosan?: string; alphabet?: string; gostop?: string; gostopticker?: string; territory?: string; sudopoly?: string };

export default async function Page({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Views> }) {
  const [{ key }, { board, battle, steal, scenario, prize, sigcount, spin, spintally, dice, twowheel, randomsig, relay, jupjup, medley, sigbingo, griddraw, sighunter, sigdosan, alphabet, gostop, gostopticker, territory, sudopoly }] = await Promise.all([params, searchParams]);
  const [data, signal] = await Promise.all([getOverlayScoreboard(key), getOverlaySignal(key, "crew")]);
  // An invalid key looks like a missing page (no hint that the URL format is right).
  if (data === "FORBIDDEN" || signal === "FORBIDDEN") notFound();
  const { reloadSeq } = signal;
  // 크루 점수판 오버레이 테마 (방송 운영 screen) for every crew view.
  const theme = overlayTheme(readLook("crew"));
  // 리모컨 기능 제어 OFF: every crew view shows nothing (it keeps polling, so ON brings it back).
  const live = data === "IDLE" || !signal.on ? null : data;
  // ?board=번호 shows that 서브 점수판 instead of the main board (nothing until it exists).
  if (board !== undefined) return <SubBoardOverlay board={live?.subBoards.find((s) => String(s.no) === board) ?? null} reloadSeq={reloadSeq} theme={theme} />;
  // ?prize shows the 상품 순위표 while 방송 운영 has it on.
  if (prize !== undefined) return <PrizeBoardOverlay board={live?.prizeBoard ?? null} reloadSeq={reloadSeq} theme={theme} />;
  // ?sigcount shows the 시그 카운트 table while 방송 운영 has it on.
  if (sigcount !== undefined) return <SigCountOverlay table={live?.sigCount ?? null} reloadSeq={reloadSeq} theme={theme} />;
  // 점수 게임 (2026-10-23): ?spin · ?dice · ?twowheel · ?randomsig · ?relay · ?jupjup · ?medley · ?sigbingo · ?griddraw · ?sighunter · ?sigdosan · ?alphabet · ?gostop · ?territory · ?sudopoly play their runs in turn; ?spintally shows the 스핀머신 BJ별 집계, ?gostopticker the 고스톱 진행 자막.
  if (spin !== undefined) return <SpinMachineOverlay spin={live?.spin ?? null} serverNow={live?.serverNow ?? null} reloadSeq={reloadSeq} theme={theme} />;
  if (spintally !== undefined) return <SpinTallyOverlay spin={live?.spin ?? null} reloadSeq={reloadSeq} theme={theme} />;
  if (dice !== undefined) return <DiceOverlay dice={live?.dice ?? null} serverNow={live?.serverNow ?? null} reloadSeq={reloadSeq} theme={theme} />;
  if (randomsig !== undefined) return <RandomSigOverlay randomSig={live?.randomSig ?? null} serverNow={live?.serverNow ?? null} reloadSeq={reloadSeq} theme={theme} />;
  if (relay !== undefined) return <RelayOverlay relay={live?.relay ?? null} serverNow={live?.serverNow ?? null} reloadSeq={reloadSeq} theme={theme} />;
  if (jupjup !== undefined) return <JupjupOverlay jupjup={live?.jupjup ?? null} serverNow={live?.serverNow ?? null} reloadSeq={reloadSeq} theme={theme} />;
  if (medley !== undefined) return <MedleyOverlay medley={live?.medley ?? null} serverNow={live?.serverNow ?? null} reloadSeq={reloadSeq} theme={theme} />;
  if (sigbingo !== undefined) return <SigBingoOverlay sigBingo={live?.sigBingo ?? null} serverNow={live?.serverNow ?? null} reloadSeq={reloadSeq} theme={theme} />;
  if (griddraw !== undefined) return <GridDrawOverlay gridDraw={live?.gridDraw ?? null} serverNow={live?.serverNow ?? null} reloadSeq={reloadSeq} theme={theme} />;
  if (sighunter !== undefined) return <SigHunterOverlay sigHunter={live?.sigHunter ?? null} serverNow={live?.serverNow ?? null} reloadSeq={reloadSeq} theme={theme} />;
  if (sigdosan !== undefined) return <SigDosanOverlay sigDosan={live?.sigDosan ?? null} serverNow={live?.serverNow ?? null} reloadSeq={reloadSeq} theme={theme} />;
  if (alphabet !== undefined) return <AlphabetOverlay alphabet={live?.alphabet ?? null} serverNow={live?.serverNow ?? null} reloadSeq={reloadSeq} theme={theme} />;
  if (gostop !== undefined) return <GoStopOverlay gostop={live?.gostop ?? null} serverNow={live?.serverNow ?? null} reloadSeq={reloadSeq} theme={theme} />;
  if (gostopticker !== undefined) return <GoStopTicker gostop={live?.gostop ?? null} serverNow={live?.serverNow ?? null} reloadSeq={reloadSeq} theme={theme} />;
  if (territory !== undefined) return <TerritoryOverlay territory={live?.territory ?? null} serverNow={live?.serverNow ?? null} reloadSeq={reloadSeq} theme={theme} />;
  if (sudopoly !== undefined) return <SudopolyOverlay sudopoly={live?.sudopoly ?? null} serverNow={live?.serverNow ?? null} reloadSeq={reloadSeq} theme={theme} />;
  if (twowheel !== undefined) return <TwoWheelOverlay wheel={live?.twoWheel ?? null} serverNow={live?.serverNow ?? null} reloadSeq={reloadSeq} theme={theme} />;
  // ?scenario shows the running 콘텐츠 시나리오 part.
  if (scenario !== undefined) return <ScenarioOverlay scenario={live?.scenario ?? null} serverNow={live?.serverNow ?? null} reloadSeq={reloadSeq} theme={theme} />;
  // ?steal shows the latest 기여도 강탈 spin for a few seconds.
  if (steal !== undefined) return <StealOverlay latest={live?.steals[0] ?? null} serverNow={live?.serverNow ?? null} reloadSeq={reloadSeq} theme={theme} />;
  // ?battle shows the running 실시간 배틀 (or the last result) instead.
  if (battle !== undefined) return <BattleOverlay battle={live?.battles.find((b) => b.running) ?? live?.battles.at(-1) ?? null} reloadSeq={reloadSeq} theme={theme} />;
  return <CrewScoreOverlay data={live} reloadSeq={reloadSeq} theme={theme} />;
}
