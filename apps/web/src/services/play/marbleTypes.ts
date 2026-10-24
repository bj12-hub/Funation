import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import type { Platform } from "@/types/platform";

/**
 * 마블 룰렛 — code-first, StreamDonate 마블 룰렛 참고 (P2 시청자 참여 게임, free: no FN, no points). Viewers join a round
 * by typing the keyword in chat (통합 채팅 `!참여`) or through a VIP 초대 링크; the operator can add names too. The race's
 * finishing order is drawn by the server when it starts; OBS animates the marbles to that order and shows who won by the
 * 당첨 rule (1등 · 꼴등 · N등). Rounds are kept as 회차별 결과.
 */

export const MARBLE_TITLE_DEFAULT = "마블 룰렛";
export const MARBLE_TITLE_MAX = 20;
export const MARBLE_KEYWORD_MAX = 10;
export const MARBLE_PLAYERS_MIN = 4;
export const MARBLE_PLAYERS_MAX = 50;
export const MARBLE_NAME_MAX = 20;
export const MARBLE_RACE_MIN_SEC = 10;
export const MARBLE_RACE_MAX_SEC = 60;
/** Seconds between 레이스 시작 and the marbles leaving (OBS counts down). */
export const MARBLE_LEAD_SEC = 3;
export const MARBLE_HISTORY_MAX = 20;

/** How viewers join: typing the keyword in chat, or the VIP 초대 링크 (no chat entries). */
export type MarbleMode = "CHAT" | "INVITE";
export const MARBLE_MODES: { key: MarbleMode; label: string }[] = [
  { key: "CHAT", label: "채팅으로 참가" },
  { key: "INVITE", label: "초대 링크 (VIP)" }
];
export type MarbleMap = "PINS" | "ZIGZAG" | "SPIRAL" | "STAIRS";
export const MARBLE_MAPS: { key: MarbleMap; label: string }[] = [
  { key: "PINS", label: "핀볼" },
  { key: "ZIGZAG", label: "지그재그" },
  { key: "SPIRAL", label: "나선" },
  { key: "STAIRS", label: "계단" }
];
/** Who wins: the first marble in, the last, or the N-th. */
export type MarbleWinRule = "FIRST" | "LAST" | "RANK";
export const MARBLE_WIN_RULES: { key: MarbleWinRule; label: string }[] = [
  { key: "FIRST", label: "1등" },
  { key: "LAST", label: "꼴등" },
  { key: "RANK", label: "N등" }
];
/** 스킬 (looks only — the order is the server's): 부스트 · 순간이동 · 역주행 · 멈춤. */
export type MarbleSkill = "BOOST" | "WARP" | "BACK" | "STOP";
export const MARBLE_SKILL_LABEL: Record<MarbleSkill, string> = { BOOST: "부스트!", WARP: "순간이동!", BACK: "역주행!", STOP: "멈춤!" };

export type MarbleSettings = {
  title: string;
  mode: MarbleMode;
  keyword: string;
  maxPlayers: number;
  map: MarbleMap;
  skills: boolean;
  winRule: MarbleWinRule;
  winRank: number;
  raceSec: number;
};
export const DEFAULT_MARBLE: MarbleSettings = { title: "", mode: "CHAT", keyword: "!참여", maxPlayers: MARBLE_PLAYERS_MAX, map: "PINS", skills: true, winRule: "FIRST", winRank: 2, raceSec: 20 };

/** The 당첨 rule as read: "1등" · "꼴등" · "3등". */
export const marbleRuleLabel = (rule: MarbleWinRule, rank: number) => (rule === "RANK" ? `${rank}등` : MARBLE_WIN_RULES.find((r) => r.key === rule)!.label);

/** Where an entrant came from: a chat platform, the 초대 링크, or the operator. */
export type MarbleSource = Platform | "INVITE" | "MANUAL";
export type MarbleEntrant = { id: string; name: string; source: MarbleSource };
/**
 * A race: it starts at `startAt` and the last marble is in at `finishAt`. `order`: entrant ids, first in first;
 * `skills`: when (0 ~ 1 of the way) each 스킬 shows.
 */
export type MarbleRace = { startAt: string; finishAt: string; map: MarbleMap; order: string[]; skills: { entrantId: string; kind: MarbleSkill; at: number }[]; winnerId: string };
/** A round: `status` OPEN (모집 중) → RACING → DONE (by the clock once raced). */
export type MarbleRound = {
  id: string;
  no: number;
  status: "OPEN" | "RACING" | "DONE";
  mode: MarbleMode;
  keyword: string;
  maxPlayers: number;
  rule: string;
  entrants: MarbleEntrant[];
  race: MarbleRace | null;
};
export type MarbleHistoryEntry = { no: number; at: string; players: number; map: MarbleMap; rule: string; winner: string };

/** The studio view: `invitePath` while an INVITE round is open. */
export type MarbleView = {
  settings: MarbleSettings;
  round: MarbleRound | null;
  invitePath: string | null;
  history: MarbleHistoryEntry[];
  overlayPath: string;
  serverNow: string;
};
/** OBS: the round without the invite; `reloadSeq` · `on` from 리모컨. */
export type MarbleOverlayView = { title: string; round: MarbleRound | null; history: MarbleHistoryEntry[]; theme: ResolvedTheme; serverNow: string; reloadSeq: number; on: boolean };
/** The 초대 링크 page: the round as a viewer sees it. */
export type MarbleInviteView = { title: string; open: boolean; players: number; maxPlayers: number };

export type MarbleResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };
export type MarbleJoinResult = { status: "JOINED"; players: number } | { status: "INVALID"; message: string };

/**
 * Where a marble is `t` seconds into the race (0 ~ 1 down the course) when it is in at `finish` seconds: an even run with
 * a wobble of its own, plus a 스킬 bump (looks only — every marble is in exactly at its finish).
 */
export function marbleProgress(t: number, finish: number, seed: number, skill: { kind: MarbleSkill; at: number } | null) {
  if (t <= 0) return 0;
  if (t >= finish) return 1;
  const p = t / finish;
  const ease = p * p * (3 - 2 * p);
  const wobble = 0.04 * Math.sin(p * Math.PI * (3 + (seed % 3))) * Math.sin(p * Math.PI);
  let bump = 0;
  if (skill) {
    const size = { BOOST: 0.1, WARP: 0.16, BACK: -0.1, STOP: -0.06 }[skill.kind];
    const width = skill.kind === "WARP" ? 0.05 : 0.12;
    bump = size * Math.exp(-(((p - skill.at) / width) ** 2)) * 4 * p * (1 - p);
  }
  return Math.min(1, Math.max(0, ease + wobble + bump));
}
