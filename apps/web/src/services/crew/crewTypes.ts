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

/** `gradeId`: the member's 직급 (see CrewGrade), null/missing = none. */
export type CrewMember = { id: string; name: string; role: CrewRole; active: boolean; color: string; gradeId?: string | null };

/**
 * 직급 (엑셀방송 직급전, funnation 참고 — 2026-10-06 결정). The creator names the grades; each has a 직급 배수 that
 * multiplies what a member of that grade receives in a broadcast (donations + 후원 리스트). The default 배수 is 1배
 * (no effect), like 배틀 (2026-10-05 결정); the creator can change it.
 */
export type CrewGrade = { id: string; name: string; multiplier: number };
export const GRADES_MAX = 10;
export const GRADE_NAME_MAX = 10;
export const GRADE_MULTIPLIER_MAX = 10;

export type MemberRankRow = { memberId: string; name: string; role: CrewRole; totalFn: number; count: number; sharePercent: number };

export type CrewStudioView = { channelName: string; members: CrewMember[]; grades: CrewGrade[]; ranking: MemberRankRow[]; month: string };

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
/** `battle` = extra points from 배틀 배수 (what the member received in a ×n battle counts n times; 2026-10-05 결정). */
export type ScoreRow = { memberId: string; name: string; color: string; team: TeamKey | null; donated: number; feed: number; adjust: number; stolen: number; battle: number; grade: number; score: number };

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
/** BANK = SMS 계좌후원 (원, no platform; 2026-10-06). */
export type FeedSource = "DONATION" | "SIM" | "BANK";

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
export type FeedSourceKey = "SOMNATION" | "BANK" | Platform;
export type FeedSummaryRow = { memberId: string | null; name: string; color: string | null; points: Partial<Record<FeedSourceKey, number>>; total: number };
export type ScoreLog = { id: string; at: string; memberName: string; points: number; reason: string };

/**
 * 랭크업 (엑셀방송, funnation 참고 — 2026-10-06 결정): the two neighbours on the scoreboard with the smallest gap, i.e.
 * the overtake that is closest. Ties pick the higher pair; 0 = 동점. None until someone above has points.
 */
export type RankUp = {
  upper: { memberId: string; name: string; rank: number; score: number };
  lower: { memberId: string; name: string; rank: number; score: number };
  gap: number;
};

/** `rows` sorted best first (the scoreboard order). */
export function rankUpPair(rows: Pick<ScoreRow, "memberId" | "name" | "score">[]): RankUp | null {
  let best: RankUp | null = null;
  for (let i = 1; i < rows.length; i++) {
    const upper = rows[i - 1];
    const lower = rows[i];
    if (upper.score <= 0) break;
    const gap = upper.score - lower.score;
    if (!best || gap < best.gap) {
      best = {
        upper: { memberId: upper.memberId, name: upper.name, rank: i, score: upper.score },
        lower: { memberId: lower.memberId, name: lower.name, rank: i + 1, score: lower.score },
        gap
      };
    }
  }
  return best;
}

/** Rows the OBS crew scoreboard lists (main board and 서브 점수판). */
export const OVERLAY_BOARD_ROWS = 10;

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
  /** 콘텐츠 시나리오 progress (null until the first part starts). */
  scenario: ScenarioLive | null;
  rankUp: RankUp | null;
  /** The operator shows 랭크업 on the OBS scoreboard. */
  showRankUp: boolean;
  /** 팬 메시지 · 요청사항 sent from the room during this broadcast. */
  fanNotes: FanNotesView;
  /** Server clock when this view was read: timers (시나리오 경과, 강탈 card) correct the browser's clock with it. */
  serverNow: string;
};

// ── 콘텐츠 시나리오 도우미 (1부 ~ 5부) — code-first ─────────────────────────────────────────────

export const SCENARIO_PARTS_MAX = 5;
export const SCENARIO_TITLE_MAX = 20;
export const SCENARIO_MEMO_MAX = 200;
export const SCENARIO_MINUTES_MAX = 600;

/** One 부 of the plan. `minutes` null = no planned length. `openBoard` opens a 서브 점수판 when the part starts. */
export type ScenarioPart = { title: string; minutes: number | null; memo: string; openBoard: boolean };

export type ScenarioLive = {
  /** The plan as it was when the first part started (later edits apply to the next broadcast). */
  parts: ScenarioPart[];
  /** Index of the running part; null after 시나리오 마치기. */
  current: number | null;
  history: { index: number; title: string; startedAt: string; endedAt: string | null }[];
};

// ── 기여도 강탈 룰렛 — code-first; slots and odds are set by the creator ────────────────────────

export const STEAL_SLOTS_MAX = 12;
export const STEAL_LABEL_MAX = 12;
export const STEAL_WEIGHT_MAX = 100;
export const STEAL_POINTS_MAX = 10_000_000;

/** PERCENT: that % of the target's current score. POINTS: a fixed amount (never more than the target has). MISS: 꽝. */
export type StealKind = "PERCENT" | "POINTS" | "MISS";
/** `weight` = relative chance (a slot with weight 2 comes up twice as often as weight 1). */
export type StealSlot = { id: string; label: string; kind: StealKind; value: number; weight: number };

export type StealRecord = { id: string; at: string; thiefId: string; thiefName: string; targetId: string; targetName: string; slotId: string; slotLabel: string; points: number };

/** 강탈 기준 (2026-10-05 결정: 플랫폼 기본값 + 크리에이터 수정). BROADCAST: the target's score in the whole broadcast
 * (보정 included). BATTLE: what the target received in the running battle only. */
export type StealBasis = "BROADCAST" | "BATTLE";
export const STEAL_BASES: { key: StealBasis; label: string }[] = [
  { key: "BROADCAST", label: "방송 전체 점수" },
  { key: "BATTLE", label: "진행 중인 배틀 점수" }
];
export const STEAL_COOLDOWN_MAX = 3600;
/** 쿨다운 choices on the remote (seconds; 0 = 없음). */
export const STEAL_COOLDOWN_STEPS = [0, 30, 60, 180, 300] as const;
export type StealRules = { basis: StealBasis; cooldownSec: number };
/** Platform defaults: 방송 전체 점수, 쿨다운 없음. */
export const PLATFORM_STEAL_RULES: StealRules = { basis: "BROADCAST", cooldownSec: 0 };

export type StealSpinResult = { status: "SPUN"; record: StealRecord; slotIndex: number } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

// ── 실시간 배틀 (같은 크루 안 BJ 1:1 또는 A팀 vs B팀 · 타이머) — code-first ─────────────────────

export const BATTLES_MAX = 20;
export const BATTLE_TITLE_MAX = 20;
export const BATTLE_MIN_SEC = 10;
export const BATTLE_MAX_SEC = 3 * 3600;
/** Quick time buttons on the remote (seconds; negative takes time away). */
export const BATTLE_TIME_STEPS = [-60, -30, 30, 60] as const;
export const BATTLE_MULTIPLIER_MAX = 10;
export const BATTLE_PENALTY_MAX = 40;
/** 배틀 배수 · 벌칙 (2026-10-05 결정: 플랫폼 기본값 + 크리에이터 수정). The channel keeps its own defaults for new battles. */
export type BattleRules = { multiplier: number; penalty: string };
/** Platform defaults: 배수 1배, 벌칙 없음. */
export const PLATFORM_BATTLE_RULES: BattleRules = { multiplier: 1, penalty: "" };

/** MEMBERS: one BJ against another. TEAMS: the broadcast's A팀 vs B팀 (team mode only). */
export type BattleMode = "MEMBERS" | "TEAMS";
export type BattleSide = { key: TeamKey; label: string; color: string; memberIds: string[]; score: number };

/**
 * Score of a side = points its members received while the battle runs (same 자동엑셀 points as the
 * scoreboard, 보정 excluded) × the battle's 배수. The main scoreboard counts those points × 배수 too (2026-10-05 결정;
 * see ScoreRow.battle). The battle ends when
 * time runs out or the operator stops it; the losing side does the 벌칙 (empty = 벌칙 없음).
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
  multiplier: number;
  penalty: string;
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
  /** 강탈 기준 · 쿨다운 and the 배틀 배수 · 벌칙 for new battles (kept across broadcasts; platform defaults until changed). */
  stealRules: StealRules;
  battleRules: BattleRules;
  /** 콘텐츠 시나리오 plan (kept across broadcasts; editable before going live). */
  scenario: ScenarioPart[];
  keywords: Record<string, string[]>;
  /** Existing project names (for the start form). */
  projects: string[];
  history: BroadcastSummary[];
  overlayPath: string;
};

export type BroadcastResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

export const crewRoleLabel = (r: CrewRole) => CREW_ROLES.find((x) => x.key === r)!.label;

// ── 팬 메시지 · 요청사항 — code-first (funnation 엑셀방송, 2026-10-06 결정) ──────────────────────────

export const FAN_NOTE_KINDS = [
  { key: "MESSAGE", label: "팬 메시지", emoji: "💌" },
  { key: "REQUEST", label: "요청사항", emoji: "🙋" }
] as const;
export type FanNoteKind = (typeof FAN_NOTE_KINDS)[number]["key"];

/** NEW = not handled yet; DONE = 확인 · 완료; HIDDEN = the operator hid it (the sender still sees "전달됨"). */
export type FanNoteStatus = "NEW" | "DONE" | "HIDDEN";

/** `mine` = notes the sender sees; `shown` = notes in the operator list. */
export const FAN_NOTE_LIMITS = { textMax: 100, mine: 5, shown: 200 } as const;

/**
 * 도배 기준 (2026-10-06 결정: 크리에이터가 조절): seconds between two notes from one viewer and the most notes one
 * broadcast takes. Platform defaults below; the ranges are placeholders (TBD: 도배 정책).
 */
export type FanNoteRules = { cooldownSec: number; perBroadcast: number };
export const PLATFORM_FAN_NOTE_RULES: FanNoteRules = { cooldownSec: 30, perBroadcast: 500 };
export const FAN_NOTE_RULE_RANGE = { cooldownSec: [0, 300], perBroadcast: [10, 500] } as const;

/** One note as the operator sees it (the sender's account id stays on the server). */
export type FanNote = { id: string; at: string; kind: FanNoteKind; memberId: string | null; memberName: string | null; author: string; text: string; status: FanNoteStatus };

/** `notes`: newest first, at most FAN_NOTE_LIMITS.shown; `counts` cover every note of the broadcast. */
export type FanNotesView = { open: boolean; rules: FanNoteRules; notes: FanNote[]; counts: Record<FanNoteStatus, number> };

/** The room card while the channel's crew broadcast takes notes (null otherwise). */
export type RoomFanNotes = {
  broadcastId: string;
  title: string;
  members: { id: string; name: string; color: string }[];
  /** Seconds until this viewer may send again (0 = now; always 0 when signed out). */
  cooldownLeft: number;
  /** The channel's 도배 기준 (shown under the box). */
  cooldownSec: number;
  /** This viewer's latest notes (newest first); `done` once the operator marks it 완료. */
  mine: { id: string; kind: FanNoteKind; memberName: string | null; text: string; done: boolean }[];
};

export type FanNoteResult =
  | { status: "SENT"; room: RoomFanNotes }
  | { status: "COOLDOWN"; seconds: number }
  | { status: "CLOSED" }
  | { status: "INVALID"; message: string }
  | { status: "UNAUTHORIZED" };
