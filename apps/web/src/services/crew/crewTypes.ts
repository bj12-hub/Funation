import type { Platform } from "@/types/platform";

/**
 * Crew (크루) — code-first, no Figma frame (docs/figma/code-first-screens.md). A channel can have
 * crew members; supporters may attribute a donation to a member, and the channel sees a per-member
 * ranking. Reference idea: docs/research/funnation-reference.md P1-1 (크루/엑셀 방송).
 *
 * Money is unchanged: a member-attributed donation is the same Donation Core debit, credited to the
 * channel. How (or whether) earnings are split between members is TBD and not implemented.
 */

export const MAX_CREW_MEMBERS = 30;
export const MEMBER_NAME_RULE = /^[가-힣A-Za-z0-9 _]{1,12}$/;

export const CREW_ROLES = [
  { key: "LEADER", label: "대표" },
  { key: "MEMBER", label: "멤버" }
] as const;
export type CrewRole = (typeof CREW_ROLES)[number]["key"];

export type CrewMember = { id: string; name: string; role: CrewRole; active: boolean; color: string };

export type MemberRankRow = { memberId: string; name: string; role: CrewRole; totalFn: number; count: number; sharePercent: number };

export type CrewStudioView = { channelName: string; members: CrewMember[]; ranking: MemberRankRow[]; month: string };

/** Public crew info for a channel's donation panel (active members only). */
export type CrewPublic = { members: { id: string; name: string; role: CrewRole; color: string }[] };

export type CrewSaveResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

// ── 크루 방송 (회차 · 점수판 · 이력) ────────────────────────────────────────────────

export type TeamKey = "A" | "B";
export const MAX_ADJUST_POINTS = 10_000_000;
export const ADJUST_REASON_MAX = 40;
export const BROADCAST_TITLE_MAX = 40;

/**
 * Points (자동엑셀 기준): `donated` = member-targeted donations; `feed` = 후원 리스트 entries assigned to
 * the member; `stolen` = net 기여도 강탈 (taken minus lost).
 */
export type ScoreRow = { memberId: string; name: string; color: string; team: TeamKey | null; donated: number; feed: number; adjust: number; stolen: number; score: number };

// ── 후원 리스트 (키워드 배정 · 한방) — reference: funnation 엑셀콘 v3 ────────────────────

export const PROJECT_NAME_MAX = 20;
export const KEYWORD_MAX = 12;
export const KEYWORDS_PER_MEMBER = 10;
export const SIM_AMOUNT_MAX = 10_000_000;
export const SIM_TEXT_MAX = 60;

/** AUTO: a keyword match is scored at once. CONFIRM: a match waits until the operator confirms. */
export type AssignMode = "AUTO" | "CONFIRM";
/** POT = collected by an active 한방 window; CANCELLED entries never score. */
export type FeedStatus = "ASSIGNED" | "PENDING" | "UNMATCHED" | "POT" | "CANCELLED";
export type FeedSource = "DONATION" | "SIM";

export type FeedEntry = {
  id: string;
  at: string;
  donor: string;
  message: string;
  /** Amount in its own unit: FN (Somnation), 원 · USD · JPY (YouTube), 별풍선 (SOOP), 치즈 (CHZZK), FlexTV 후원. */
  amount: number;
  unit: ExcelUnit;
  /** Broadcast platform the donation came from; null = Somnation (FN). */
  platform: Platform | null;
  source: FeedSource;
  status: FeedStatus;
  memberId: string | null;
  /** Keyword match (shown for PENDING entries). */
  suggestedMemberId: string | null;
  /** Given through a 한방 (badge). */
  oneshot: boolean;
  /** 기여도 수기 입력: fixed points or a multiplier of the converted amount. null = 배수 규칙. */
  contribution: Contribution | null;
};

/** A 후원 리스트 entry with its server-computed score (자동엑셀). */
export type FeedEntryView = FeedEntry & {
  /** Amount in the score unit (FN or 원); null = no conversion value for this unit yet. */
  base: number | null;
  multiplier: number;
  points: number;
};

export type FeedView = {
  assignMode: AssignMode;
  keywords: Record<string, string[]>;
  /** Newest first. */
  entries: FeedEntryView[];
  oneshot: { startedAt: string; potPoints: number; count: number } | null;
  excel: ExcelSettings;
  /** 플랫폼 · BJ별 정리: points per source (Somnation + each platform) for every member, plus 미지정. */
  summary: FeedSummaryRow[];
};

// ── 자동엑셀 (원화 환산 · 기여도) — code-first; conversion values are entered by the creator ─────────

/** Units a 후원 리스트 entry can carry. 원 is the 원화 기준 itself; every other unit needs a value. */
export const EXCEL_UNITS = [
  { key: "FN", label: "FN", platform: null },
  { key: "KRW", label: "원", platform: "YOUTUBE" },
  { key: "USD", label: "USD", platform: "YOUTUBE" },
  { key: "JPY", label: "JPY", platform: "YOUTUBE" },
  { key: "별풍선", label: "별풍선", platform: "SOOP" },
  { key: "치즈", label: "치즈", platform: "CHZZK" },
  { key: "FlexTV 후원", label: "FlexTV 후원", platform: "FLEXTV" }
] as const satisfies readonly { key: string; label: string; platform: Platform | null }[];
export type ExcelUnit = (typeof EXCEL_UNITS)[number]["key"];
export const isExcelUnit = (v: unknown): v is ExcelUnit => EXCEL_UNITS.some((u) => u.key === v);

/** FN: 1 FN = 1점 (기존 점수판). KRW: every unit is converted to 원 with the creator's values. */
export type ExcelScoreUnit = "FN" | "KRW";

/** 배수 규칙: an entry whose converted amount is at least `min` gets `multiplier` (the highest matching rule wins). */
export type MultiplierRule = { min: number; multiplier: number };

export type ExcelSettings = {
  unit: ExcelScoreUnit;
  /** 1 unit = N원, entered by the creator (TBD: platform rates are not decided). Missing = not set. */
  rates: Partial<Record<ExcelUnit, number>>;
  rules: MultiplierRule[];
};

export const EXCEL_RULES_MAX = 5;
export const EXCEL_RATE_MAX = 1_000_000;
export const EXCEL_RULE_MIN_MAX = 1_000_000_000;
export const EXCEL_MULTIPLIER_MAX = 100;

export type Contribution = { kind: "POINTS"; value: number } | { kind: "MULTIPLIER"; value: number };

/** Source columns of 플랫폼 · BJ별 정리. */
export type FeedSourceKey = "SOMNATION" | Platform;
export type FeedSummaryRow = { memberId: string | null; name: string; color: string | null; points: Partial<Record<FeedSourceKey, number>>; total: number };
export type ScoreLog = { id: string; at: string; memberName: string; points: number; reason: string };

export type BroadcastLive = {
  id: string;
  title: string;
  /** 프로젝트 (preset) name and its auto-numbered 회차. */
  project: string | null;
  round: number | null;
  /** Points collected by an active 한방 window (shown on the overlay). */
  oneshotPot: number | null;
  startedAt: string;
  teamMode: boolean;
  rows: ScoreRow[];
  teams: { key: TeamKey; score: number }[];
  logs: ScoreLog[];
  subBoards: SubBoard[];
  /** 실시간 배틀 of this broadcast (oldest first; at most one RUNNING). */
  battles: Battle[];
  /** 기여도 강탈 spins (newest first). */
  steals: StealRecord[];
};

// ── 기여도 강탈 룰렛 — code-first; slots and odds are set by the creator (no defaults, TBD) ────────

export const STEAL_SLOTS_MAX = 12;
export const STEAL_LABEL_MAX = 12;
export const STEAL_WEIGHT_MAX = 100;
export const STEAL_POINTS_MAX = 10_000_000;

/** PERCENT: that % of the target's current score. POINTS: a fixed amount (never more than the target has). MISS: 꽝. */
export type StealKind = "PERCENT" | "POINTS" | "MISS";
/** `weight` = relative chance (a slot with weight 2 comes up twice as often as weight 1). */
export type StealSlot = { id: string; label: string; kind: StealKind; value: number; weight: number };

export type StealRecord = { id: string; at: string; thiefId: string; thiefName: string; targetId: string; targetName: string; slotId: string; slotLabel: string; points: number };

export type StealSpinResult = { status: "SPUN"; record: StealRecord; slotIndex: number } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

// ── 실시간 배틀 (같은 크루 안 BJ 1:1 또는 A팀 vs B팀 · 타이머) — code-first ─────────────────────

export const BATTLES_MAX = 20;
export const BATTLE_TITLE_MAX = 20;
export const BATTLE_MIN_SEC = 10;
export const BATTLE_MAX_SEC = 3 * 3600;
/** Quick time buttons on the remote (seconds; negative takes time away). */
export const BATTLE_TIME_STEPS = [-60, -30, 30, 60] as const;

/** MEMBERS: one BJ against another. TEAMS: the broadcast's A팀 vs B팀 (team mode only). */
export type BattleMode = "MEMBERS" | "TEAMS";
export type BattleSide = { key: TeamKey; label: string; color: string; memberIds: string[]; score: number };

/**
 * Score of a side = points its members received while the battle runs (same 자동엑셀 points as the
 * scoreboard, 보정 excluded). The battle ends when time runs out or the operator stops it.
 */
export type Battle = {
  no: number;
  title: string;
  mode: BattleMode;
  startedAt: string;
  endsAt: string;
  /** Set when stopped early (or by 방송 종료); otherwise the battle ends at `endsAt`. */
  stoppedAt: string | null;
  running: boolean;
  /** Seconds left when the view was built (0 once ended). */
  remainingSec: number;
  sides: [BattleSide, BattleSide];
  /** Leading side while running; the result once ended. null = no points yet. */
  leader: TeamKey | "DRAW" | null;
};

export const SUB_BOARD_MAX = 5;
export const SUB_BOARD_TITLE_MAX = 20;

/** Score = member FN donated (targeted + 후원 리스트 반영) while the board is open. Display points only. */
export type SubBoard = {
  no: number;
  title: string;
  openedAt: string;
  closedAt: string | null;
  rows: { memberId: string; name: string; color: string; score: number }[];
};

export type BroadcastSummary = { id: string; title: string; project: string | null; round: number | null; startedAt: string; endedAt: string; totalScore: number; winner: string | null; top: { name: string; score: number }[] };

export type BroadcastView = {
  members: CrewMember[];
  live: BroadcastLive | null;
  /** Only while live; never sent to the overlay (donor messages stay in the studio). */
  feed: FeedView | null;
  /** 기여도 강탈 룰렛 slots (kept across broadcasts). */
  stealSlots: StealSlot[];
  keywords: Record<string, string[]>;
  /** Existing project names (for the start form). */
  projects: string[];
  history: BroadcastSummary[];
  overlayPath: string;
};

export type BroadcastResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

export const crewRoleLabel = (r: CrewRole) => CREW_ROLES.find((x) => x.key === r)!.label;
