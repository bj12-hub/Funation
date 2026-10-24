import { UNIT_LABEL, toUnitCode, type UnitCode } from "@/types/donationUnit";
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
/** `game`: points from 점수 게임 results (스핀머신 …), counted once the result shows on OBS. */
export type ScoreRow = { memberId: string; name: string; color: string; team: TeamKey | null; donated: number; feed: number; adjust: number; stolen: number; battle: number; grade: number; game: number; score: number };

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
  /** The name as sent — what the operator's 후원 리스트 (방송 운영) shows. */
  donor: string;
  /**
   * The name for anything on stream (2026-10-09 결정): a Ssumnation donation's name after the creator's 대체 메시지 rules
   * (익명 or the 대체 문구), fixed when it was sent so a later 금지어 change does not rewrite it. Platform · 계좌 후원 and
   * 시뮬 후원 entries are not replaced (their alerts show the name as sent), so it equals `donor` there.
   */
  shownDonor: string;
  message: string;
  /**
   * Amount in its own unit (code): FN (Ssumnation), KRW · USD · JPY (YouTube; KRW also 계좌 후원), SOOP_BALLOON (별풍선),
   * CHZZK_CHEESE (치즈), FLEXTV_UNIT (FlexTV 후원). Entries listed before the codes carry the label until read (feedOf).
   */
  amount: number;
  unit: ExcelUnit;
  /** Broadcast platform the donation came from; null = Ssumnation (FN). */
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
  /** 플랫폼 · BJ별 정리: points per source (Ssumnation + each platform) for every member, plus 미지정. */
  summary: FeedSummaryRow[];
};

// ── 자동엑셀 (원화 환산 · 기여도) — code-first; conversion values are entered by the creator ─────────

/**
 * Units a 후원 리스트 entry can carry, by stable code (types/donationUnit) — 환산값 and entries are keyed by the code,
 * screens show the label. 원 is the 원화 기준 itself; every other unit needs a value. `platform`: where a 시뮬 후원 in
 * that unit comes from (원 is also 계좌 후원, which has none).
 */
export const EXCEL_UNITS = [
  { key: "FN", label: UNIT_LABEL.FN, platform: null },
  { key: "KRW", label: UNIT_LABEL.KRW, platform: "YOUTUBE" },
  { key: "USD", label: UNIT_LABEL.USD, platform: "YOUTUBE" },
  { key: "JPY", label: UNIT_LABEL.JPY, platform: "YOUTUBE" },
  { key: "SOOP_BALLOON", label: UNIT_LABEL.SOOP_BALLOON, platform: "SOOP" },
  { key: "CHZZK_CHEESE", label: UNIT_LABEL.CHZZK_CHEESE, platform: "CHZZK" },
  { key: "FLEXTV_UNIT", label: UNIT_LABEL.FLEXTV_UNIT, platform: "FLEXTV" }
] as const satisfies readonly { key: UnitCode; label: string; platform: Platform | null }[];
export type ExcelUnit = (typeof EXCEL_UNITS)[number]["key"];
export const isExcelUnit = (v: unknown): v is ExcelUnit => EXCEL_UNITS.some((u) => u.key === v);
/** The 자동엑셀 unit for a code, or for a label stored or sent before the codes (별풍선 → SOOP_BALLOON …); else null. */
export function excelUnitOf(v: unknown): ExcelUnit | null {
  const code = toUnitCode(v);
  return isExcelUnit(code) ? code : null;
}

/** FN: 1 FN = 1점 (기존 점수판). KRW: every unit is converted to 원 with the creator's values. */
export type ExcelScoreUnit = "FN" | "KRW";

/** 배수 규칙: an entry whose converted amount is at least `min` gets `multiplier` (the highest matching rule wins). */
export type MultiplierRule = { min: number; multiplier: number };

export type ExcelSettings = {
  unit: ExcelScoreUnit;
  /**
   * 1 unit = N원 per unit code, entered by the creator (TBD: platform rates are not decided). Missing = not set. Values
   * saved before the codes are keyed by label and moved to the code when read (excelOf).
   */
  rates: Partial<Record<ExcelUnit, number>>;
  rules: MultiplierRule[];
};

export const EXCEL_RULES_MAX = 5;
export const EXCEL_RATE_MAX = 1_000_000;
export const EXCEL_RULE_MIN_MAX = 1_000_000_000;
export const EXCEL_MULTIPLIER_MAX = 100;

export type Contribution = { kind: "POINTS"; value: number } | { kind: "MULTIPLIER"; value: number };

/** Source columns of 플랫폼 · BJ별 정리. */
export type FeedSourceKey = "SSUMNATION" | "BANK" | Platform;
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
  /** 상품 순위표 with the channel's settings and this broadcast's ranks (OBS `?prize`). */
  prizeBoard: PrizeBoardLive;
  /** 시그 카운트: signatures each member received during this broadcast (OBS `?sigcount`). */
  sigCount: SigCountLive;
  /** 점수 게임: settings and recent runs with their OBS timing (`?spin` · `?spintally` · `?dice` · `?twowheel`). */
  spin: SpinLive;
  dice: DiceLive;
  twoWheel: TwoWheelLive;
  randomSig: RandomSigLive;
  relay: RelayLive;
  jupjup: JupjupLive;
  medley: MedleyLive;
  sigBingo: SigBingoLive;
  /** Closed cells come without their prize here, and the settings without the prize list (OBS); the studio's GamesView has them. */
  gridDraw: GridDrawLive;
  /** Unsold slots come without their 몰수권 here (OBS); the studio's GamesView has them. */
  sigHunter: SigHunterLive;
  sigDosan: SigDosanLive;
  alphabet: AlphabetLive;
  gostop: GoStopLive;
  territory: TerritoryLive;
  /** Server clock when this view was read: timers (시나리오 경과, 강탈 card) correct the browser's clock with it. */
  serverNow: string;
};

// ── 상품 순위표 (랭킹(상품) · 시간 내 랭킹) — code-first, StreamDonate 참고 (docs/research/streamdonate-reference.md) ──

export const PRIZE_TITLE_MAX = 20;
export const PRIZE_TITLE_DEFAULT = "순위표";
export const PRIZE_TEXT_MAX = 30;
/** One prize line per rank, up to the crew size. */
export const PRIZE_RANKS_MAX = MAX_CREW_MEMBERS;

/**
 * BROADCAST: the main scoreboard score. WINDOW: what members got between 시작 and 정지 — received ± 기여도 강탈, no 보정,
 * the same window score as 서브 점수판 and 실시간 배틀.
 */
export type PrizeBasis = "BROADCAST" | "WINDOW";
export const PRIZE_BASES: { key: PrizeBasis; label: string }[] = [
  { key: "BROADCAST", label: "방송 전체 점수" },
  { key: "WINDOW", label: "구간 점수 (시작 ~ 정지)" }
];

/** The screen edge the OBS card sits against (its corners there are square); FLOAT keeps every corner round. */
export type PrizePlacement = "LEFT" | "FLOAT" | "RIGHT";
export const PRIZE_PLACEMENTS: { key: PrizePlacement; label: string }[] = [
  { key: "LEFT", label: "왼쪽 붙임" },
  { key: "FLOAT", label: "플로팅" },
  { key: "RIGHT", label: "오른쪽 붙임" }
];
export const PRIZE_COLUMNS = [1, 2, 3] as const;
export type PrizeColumns = (typeof PRIZE_COLUMNS)[number];

/** A rank's 상품 · 벌칙 line. `color` null = the overlay theme's text color. */
export type RankPrize = { text: string; color: string | null };

/** Kept per channel across broadcasts, editable before going live. */
export type PrizeBoardSettings = {
  title: string;
  basis: PrizeBasis;
  /** prizes[0] = 1등. Ranks without a line show none. */
  prizes: RankPrize[];
  /** Members left out of the board; the ranks (and prize lines) shrink with them. */
  excluded: string[];
  /** 상단 고정: shown above 1등 with its own text and no rank (the others are ranked from 1). */
  pinned: { memberId: string; text: string } | null;
  columns: PrizeColumns;
  showScore: boolean;
  showTotal: boolean;
  placement: PrizePlacement;
};

export const DEFAULT_PRIZE_BOARD: PrizeBoardSettings = {
  title: "",
  basis: "BROADCAST",
  prizes: [],
  excluded: [],
  pinned: null,
  columns: 1,
  showScore: true,
  showTotal: false,
  placement: "FLOAT"
};

/** `rank` null = the pinned member. */
export type PrizeRow = { memberId: string; name: string; color: string; rank: number | null; prize: RankPrize | null; score: number };

export type PrizeBoardLive = {
  settings: PrizeBoardSettings;
  /** Shown on the OBS overlay (`?prize`); the studio always shows it. */
  visible: boolean;
  /** WINDOW basis: null until 시작; `stoppedAt` set by 정지 (or 방송 종료). */
  window: { startedAt: string; stoppedAt: string | null } | null;
  rows: PrizeRow[];
  /** Sum of the listed scores (하단 합계). */
  total: number;
};

// ── 시그 카운트 — code-first, StreamDonate 시그 카운트 참고 (docs/research/streamdonate-reference.md) ──

export const SIG_COUNT_TITLE_MAX = 20;
export const SIG_COUNT_TITLE_DEFAULT = "시그 카운트";
/** Signatures one table counts (its columns). */
export const SIG_COUNT_COLUMNS_MAX = 8;

/** RECEIVED: members who got a counted signature. ALL: every active member too, with 0s. */
export type SigCountRows = "RECEIVED" | "ALL";
export const SIG_COUNT_ROWS: { key: SigCountRows; label: string }[] = [
  { key: "RECEIVED", label: "받은 멤버만" },
  { key: "ALL", label: "활동 멤버 모두" }
];
export type SigCountSort = "TOTAL" | "ORDER";
export const SIG_COUNT_SORTS: { key: SigCountSort; label: string }[] = [
  { key: "TOTAL", label: "많이 받은 순" },
  { key: "ORDER", label: "크루 순서" }
];

/** Kept per channel across broadcasts, editable before going live. `signatureIds`: the columns, in order. */
export type SigCountSettings = { title: string; signatureIds: string[]; rows: SigCountRows; sort: SigCountSort; showTotal: boolean };

export const DEFAULT_SIG_COUNT: SigCountSettings = { title: "", signatureIds: [], rows: "RECEIVED", sort: "TOTAL", showTotal: true };

/** `memberId` null = 멤버를 지정하지 않은 시그니처 (미지정, always last). `counts` follow the columns. */
export type SigCountRow = { memberId: string | null; name: string; color: string | null; counts: number[]; total: number };

export type SigCountLive = {
  settings: SigCountSettings;
  /** Shown on the OBS overlay (`?sigcount`); the studio always shows it. */
  visible: boolean;
  /** Counted from: the broadcast start, or the last 다시 세기. */
  since: string;
  /** One per counted signature (a deleted one keeps its column as 삭제된 시그니처). */
  columns: { id: string; name: string; imageUrl: string | null }[];
  rows: SigCountRow[];
  /** Per column, over every row (하단 합계). */
  totals: number[];
};

// ── 점수 게임 (P2) — code-first, StreamDonate 참고 (docs/research/streamdonate-reference.md) ─────────────────────
// A game draws its result on the server; the result is display points only (FN · 지갑 · 수익 · 정산 never move).

/** Games on the shared engine (crewGameCore). `param`: the OBS view (`?spin`). */
export type GameKey = "SPIN" | "DICE" | "TWO_WHEEL" | "RANDOM_SIG" | "RELAY" | "JUPJUP" | "MEDLEY" | "SIG_BINGO" | "GRID_DRAW" | "SIG_HUNTER" | "SIG_DOSAN" | "ALPHABET" | "GOSTOP" | "TERRITORY";
export const GAMES: { key: GameKey; label: string; param: string }[] = [
  { key: "SPIN", label: "스핀머신", param: "spin" },
  { key: "DICE", label: "주사위 게임", param: "dice" },
  { key: "TWO_WHEEL", label: "투휠 게임", param: "twowheel" },
  { key: "RANDOM_SIG", label: "랜덤시그", param: "randomsig" },
  { key: "RELAY", label: "기여도 릴레이", param: "relay" },
  { key: "JUPJUP", label: "줍줍", param: "jupjup" },
  { key: "MEDLEY", label: "시그니처 메들리", param: "medley" },
  { key: "SIG_BINGO", label: "시그 빙고", param: "sigbingo" },
  { key: "GRID_DRAW", label: "복불복 뽑기판", param: "griddraw" },
  { key: "SIG_HUNTER", label: "시그니처 헌터", param: "sighunter" },
  { key: "SIG_DOSAN", label: "시그니처 두산", param: "sigdosan" },
  { key: "ALPHABET", label: "알파벳 모으기", param: "alphabet" },
  { key: "GOSTOP", label: "고스톱", param: "gostop" },
  { key: "TERRITORY", label: "땅따먹기", param: "territory" }
];

/**
 * OBS timing: a run starts GAME_LEAD_SEC after it is drawn (the overlay polls every 3 seconds, so it plays from the start)
 * or once the game's previous run is over; it plays for `playSec` (reel · dice), then keeps the result for `resultSec`.
 */
export const GAME_LEAD_SEC = 3;
export const GAME_TIMING: Record<GameKey, { playSec: number; resultSec: number }> = {
  SPIN: { playSec: 4, resultSec: 4 },
  DICE: { playSec: 3, resultSec: 4 },
  TWO_WHEEL: { playSec: 4, resultSec: 4 },
  RANDOM_SIG: { playSec: 2, resultSec: 4 },
  RELAY: { playSec: 2, resultSec: 4 },
  JUPJUP: { playSec: 2, resultSec: 4 },
  MEDLEY: { playSec: 2, resultSec: 4 },
  SIG_BINGO: { playSec: 1, resultSec: 5 },
  GRID_DRAW: { playSec: 1, resultSec: 4 },
  SIG_HUNTER: { playSec: 1, resultSec: 4 },
  SIG_DOSAN: { playSec: 1, resultSec: 3 },
  ALPHABET: { playSec: 3, resultSec: 3 },
  GOSTOP: { playSec: 2, resultSec: 3 },
  TERRITORY: { playSec: 1, resultSec: 3 }
};
/** Runs a game lists (studio) and queues (OBS), newest first. */
export const GAME_RUNS_SHOWN = 30;
export const GAME_TITLE_MAX = 20;

/**
 * A result's effect. MULTIPLY: the 기준 후원's points × value (adds (value − 1) × those points). ADD: + value points.
 * TEXT: a 문구 only (스핀머신 벌칙 · 미션 — counted in BJ별 집계). MISS: 꽝.
 */
export type GameEffect = "MULTIPLY" | "ADD" | "TEXT" | "MISS";

/**
 * What every game keeps per channel: its OBS title, 자동 (each 시그니처 후원 sent to a member — 금액 일치 · 금액범위
 * included — plays once, except `excluded` signatures) and whether OBS shows it between runs.
 */
export type GameCommon = { title: string; auto: boolean; excluded: string[]; showIdle: boolean };

// 스핀머신 — a slot-machine reel of the creator's items.
export const SPIN_TITLE_DEFAULT = "스핀머신";
export const SPIN_ITEMS_MAX = 12;
export const SPIN_LABEL_MAX = 12;
export const SPIN_WEIGHT_MAX = 100;
export const SPIN_MULTIPLIER_MAX = 10;
export const SPIN_POINTS_MAX = 10_000_000;

export type SpinKind = GameEffect;
export const SPIN_KINDS: { key: SpinKind; label: string }[] = [
  { key: "MULTIPLY", label: "배수" },
  { key: "ADD", label: "점수 더하기" },
  { key: "TEXT", label: "문구 (벌칙 · 미션)" },
  { key: "MISS", label: "꽝" }
];

/** A reel item. `value`: the 배수 (MULTIPLY, two decimals) or the points (ADD); 0 for TEXT · MISS. */
export type SpinItem = { id: string; label: string; kind: SpinKind; value: number; weight: number };

/** Kept per channel across broadcasts, editable before going live. */
export type SpinSettings = GameCommon & { items: SpinItem[] };

export const DEFAULT_SPIN: SpinSettings = { title: "", items: [], auto: false, excluded: [], showIdle: true };

/** 예시 칸 (일반적인 기준) the editor offers as a start; the creator sets their own odds and values. */
export const SPIN_EXAMPLE_ITEMS: Omit<SpinItem, "id">[] = [
  { label: "×2", kind: "MULTIPLY", value: 2, weight: 10 },
  { label: "×3", kind: "MULTIPLY", value: 3, weight: 4 },
  { label: "+1,000", kind: "ADD", value: 1_000, weight: 10 },
  { label: "애교 한 번", kind: "TEXT", value: 0, weight: 8 },
  { label: "꽝", kind: "MISS", value: 0, weight: 18 }
];

// 주사위 게임 — StreamDonate 주사위 게임: two dice per run, the rule turns them into a 배수 on the 기준 후원.
export const DICE_TITLE_DEFAULT = "주사위 게임";
export type DiceRule = "RULE1" | "RULE2";
export const DICE_RULES: { key: DiceRule; label: string; lines: string[] }[] = [
  { key: "RULE1", label: "룰 1", lines: ["합계 2 ~ 6 → 1배", "합계 7 ~ 12 → 2배", "더블 → 두 눈의 합 배 (1 + 1 = 2배 … 6 + 6 = 12배)"] },
  { key: "RULE2", label: "룰 2", lines: ["합계 2 ~ 7 → 2배", "합계 8 ~ 10 → 3배", "합계 11 ~ 12 → 4배", "더블 → 그 배수 × 2 (6 + 6 → 4배 × 2 = 8배)"] }
];

/** The 배수 two dice give under a rule (StreamDonate 룰 1 · 룰 2). */
export function diceMultiplier(rule: DiceRule, a: number, b: number): number {
  const sum = a + b;
  if (rule === "RULE1") return a === b ? sum : sum <= 6 ? 1 : 2;
  const m = sum <= 7 ? 2 : sum <= 10 ? 3 : 4;
  return a === b ? m * 2 : m;
}

export type DiceSettings = GameCommon & { rule: DiceRule };
export const DEFAULT_DICE: DiceSettings = { title: "", auto: false, excluded: [], showIdle: true, rule: "RULE1" };

// 투휠 게임 — StreamDonate 투휠: an operator reel (+ / ×) and a number reel (+1 ~ +10, ×1 ~ ×5), odds set by the creator.
export const TWO_WHEEL_TITLE_DEFAULT = "투휠 게임";
export const TWO_WHEEL_PLUS_MAX = 10;
export const TWO_WHEEL_TIMES_MAX = 5;
export const TWO_WHEEL_WEIGHT_MAX = 100;
export const TWO_WHEEL_UNIT_MAX = 1_000_000;

/**
 * Weights 0 ~ 100 (0 = never): `plusWeight` · `timesWeight` for the operator, `plusWeights[n − 1]` for +n and
 * `timesWeights[n − 1]` for ×n. `plusUnit`: points per +1 — our points are FN, so +3 adds 3 × plusUnit.
 */
export type TwoWheelSettings = GameCommon & { plusWeight: number; timesWeight: number; plusWeights: number[]; timesWeights: number[]; plusUnit: number };

/** 기본값 (일반적인 기준): even odds, +1 = 1,000점. */
export const DEFAULT_TWO_WHEEL: TwoWheelSettings = {
  title: "",
  auto: false,
  excluded: [],
  showIdle: true,
  plusWeight: 50,
  timesWeight: 50,
  plusWeights: Array.from({ length: TWO_WHEEL_PLUS_MAX }, () => 10),
  timesWeights: Array.from({ length: TWO_WHEEL_TIMES_MAX }, () => 10),
  plusUnit: 1_000
};

// 랜덤시그 — StreamDonate 랜덤시그: a 일반 후원 of exactly a 발동 금액 plays a random signature from that tier's price range.
export const RANDOM_SIG_TITLE_DEFAULT = "랜덤시그";
export const RANDOM_SIG_TIERS_MAX = 10;
export const RANDOM_SIG_MULTIPLIER_MAX = 10;

/** A 발동 구간: a 일반 후원 of exactly `trigger` FN draws among the active signatures priced `min` ~ `max` FN. */
export type RandomSigTier = { id: string; trigger: number; min: number; max: number };

/**
 * BONUS (기본 모드): the donation counts as it is, and a drawn signature priced at or above the 발동 금액 adds
 * (`multiplier` − 1) × its points. REPLACE (랜덤 결과 모드): the drawn signature's price counts instead of the donation
 * (the run adds the difference, which can be negative).
 */
export type RandomSigMode = "BONUS" | "REPLACE";
export const RANDOM_SIG_MODES: { key: RandomSigMode; label: string; note: string }[] = [
  { key: "BONUS", label: "기본 모드", note: "발동 후원 점수는 그대로, 뽑힌 시그 가격이 발동 금액 이상이면 기본 배수만큼 더해요." },
  { key: "REPLACE", label: "랜덤 결과 모드", note: "배수 없이, 발동 후원 대신 뽑힌 시그 가격 기준 점수로 바꿔요." }
];

/** `auto` = 랜덤시그 켜짐 (the alert plays the drawn signature even without a crew broadcast); `excluded` = 제외 시그. */
export type RandomSigSettings = GameCommon & { tiers: RandomSigTier[]; mode: RandomSigMode; multiplier: number };
/** 기본값 (StreamDonate 기본): 기본 모드, 2배. */
export const DEFAULT_RANDOM_SIG: RandomSigSettings = { title: "", auto: false, excluded: [], showIdle: true, tiers: [], mode: "BONUS", multiplier: 2 };

// 기여도 릴레이 — StreamDonate 기여도 릴레이: a 시그니처 후원 the 트리거 BJ receives sets a 배수 by its amount; the next
// 시그니처 후원 another member receives takes it.
export const RELAY_TITLE_DEFAULT = "기여도 릴레이";
export const AMOUNT_TIERS_MAX = 10;
export const AMOUNT_TIER_MULTIPLIER_MAX = 10;
export const RELAY_TIERS_MAX = AMOUNT_TIERS_MAX;
export const RELAY_MULTIPLIER_MAX = AMOUNT_TIER_MULTIPLIER_MAX;

/** A 금액 구간 (기여도 릴레이 · 줍줍 배수 모드): a 시그니처 후원 of `min` FN or more (up to `max`, null = no upper end) → ×`multiplier`. */
export type AmountTier = { id: string; min: number; max: number | null; multiplier: number };
export type RelayTier = AmountTier;

/** `auto` = 릴레이 켜짐; `memberId` = 트리거 BJ; `tiers` are matched top-down (the first wins, none = no effect). */
export type RelaySettings = GameCommon & { memberId: string | null; tiers: RelayTier[] };
export const DEFAULT_RELAY: RelaySettings = { title: "", auto: false, excluded: [], showIdle: true, memberId: null, tiers: [] };

/** 예시 구간 — StreamDonate 기여도 릴레이 기본값 as it is (its amounts are 원; set FN ranges that fit the channel's signatures). */
export const RELAY_EXAMPLE_TIERS: Omit<AmountTier, "id">[] = Array.from({ length: 9 }, (_, i) => ({ min: i * 50_000, max: i * 50_000 + 49_999, multiplier: i + 2 }));

/** The first 구간 an amount falls in, if any. */
export const amountTierFor = (tiers: AmountTier[], amount: number) => tiers.find((t) => amount >= t.min && (t.max === null || amount <= t.max)) ?? null;
export const relayTierFor = amountTierFor;

// 줍줍 — StreamDonate 줍줍: the 지정 BJ's 시그니처 후원 pile up on a stack; another member who receives one of the same
// amount takes the oldest and gets points once more.
export const JUPJUP_TITLE_DEFAULT = "줍줍";
/** Stack items listed (studio · OBS), oldest first. */
export const JUPJUP_STACK_SHOWN = 30;

/**
 * ADD (더하기 모드): the taker gets the donation's points once more. MULTIPLY (배수 모드): × the 금액 구간's 배수
 * ((배수 − 1) × the points; no 구간 = 1배). SPIN (스핀머신 연계): × the 스핀머신 배수 the same donation drew, else 1 — a spin
 * ×3 makes 1 (후원) + 2 (스핀) + 3 (줍줍) = 6배.
 */
export type JupjupMode = "ADD" | "MULTIPLY" | "SPIN";
export const JUPJUP_MODES: { key: JupjupMode; label: string; note: string }[] = [
  { key: "ADD", label: "더하기 모드", note: "가져간 멤버에게 그 후원 점수만큼 한 번 더 줘요." },
  { key: "MULTIPLY", label: "배수 모드", note: "금액 구간의 배수를 적용해요 — 가져간 멤버에게 (배수 − 1)배를 더해요." },
  { key: "SPIN", label: "스핀머신 연계", note: "같은 후원에 스핀머신 배수가 나오면 그 배수만큼, 아니면 1배만큼 더해요 (스핀 ×3 → 후원 1 + 스핀 2 + 줍줍 3 = 6배)." }
];

/** `auto` = 줍줍 켜짐; `memberIds` = 지정 BJ (their 시그니처 후원 pile up; they never take from the stack). */
export type JupjupSettings = GameCommon & { memberIds: string[]; mode: JupjupMode; tiers: AmountTier[] };
export const DEFAULT_JUPJUP: JupjupSettings = { title: "", auto: false, excluded: [], showIdle: true, memberIds: [], mode: "ADD", tiers: [] };

/** A stacked 시그니처 후원 waiting for another member's one of the same amount. `manual`: added by the operator (수동 추가). */
export type JupjupStackItem = { id: string; at: string; memberName: string; memberColor: string | null; signatureName: string; amount: number; manual: boolean };

// 시그니처 메들리 — StreamDonate 메들리: a 일반 후원 of exactly the 메들리 금액 plays one of the registered signatures at random.
// No points: the donation counts as it is.
export const MEDLEY_TITLE_DEFAULT = "시그니처 메들리";
export const MEDLEY_SIGNATURES_MAX = 50;
/** Quick picks for the 발동 금액 (StreamDonate offers 10,000 · 30,000 · 50,000). */
export const MEDLEY_TRIGGER_PRESETS = [10_000, 30_000, 50_000];

/** `auto` = 메들리 켜짐; `trigger` = 발동 금액 (FN); `signatureIds` = 등록 시그니처 (the draw is among the active ones). */
export type MedleySettings = GameCommon & { trigger: number | null; signatureIds: string[] };
export const DEFAULT_MEDLEY: MedleySettings = { title: "", auto: false, excluded: [], showIdle: true, trigger: null, signatureIds: [] };

// 시그 빙고 — StreamDonate 시그니처 빙고: signatures placed on a board, a 시그니처 후원 opens its cell, full lines are 빙고.
export const SIG_BINGO_TITLE_DEFAULT = "시그 빙고";
export const SIG_BINGO_SIZES = [3, 5, 7, 9] as const;
export type SigBingoSize = (typeof SIG_BINGO_SIZES)[number];
export const SIG_BINGO_BONUS_MAX = 10_000_000;

/** SHARED (공용 판): any 시그니처 후원 opens its cell. TERRITORY (땅따먹기): only one sent to a member, in that member's color. */
export type SigBingoMode = "SHARED" | "TERRITORY";
export const SIG_BINGO_MODES: { key: SigBingoMode; label: string; note: string }[] = [
  { key: "SHARED", label: "공용 판", note: "어떤 시그니처 후원이든 그 시그니처 칸을 열어요. 줄을 완성한 후원의 멤버가 빙고 보너스를 받아요." },
  { key: "TERRITORY", label: "땅따먹기", note: "멤버를 고른 시그니처 후원만 칸을 열고 그 멤버 색으로 차지해요. 한 줄을 모두 차지한 멤버가 빙고 보너스를 받아요." }
];
/** SHOWN (칸 공개): every cell shows its signature. HIDDEN (칸 숨김): closed cells show "?" until opened. */
export type SigBingoReveal = "SHOWN" | "HIDDEN";
export const SIG_BINGO_REVEALS: { key: SigBingoReveal; label: string }[] = [
  { key: "SHOWN", label: "칸 공개" },
  { key: "HIDDEN", label: "칸 숨김" }
];

/**
 * `auto` = 후원으로 칸 열기; `excluded` = 빙고 제외 시그; `priceMin` · `priceMax` = 금액 범위 for the board (null = no end);
 * `bonus` = points per 빙고 line (0 = none). Size · mode · reveal · range take effect on the next 빙고 시작.
 */
export type SigBingoSettings = GameCommon & { size: SigBingoSize; mode: SigBingoMode; reveal: SigBingoReveal; priceMin: number | null; priceMax: number | null; bonus: number };
export const DEFAULT_SIG_BINGO: SigBingoSettings = { title: "", auto: false, excluded: [], showIdle: true, size: 3, mode: "SHARED", reveal: "SHOWN", priceMin: null, priceMax: null, bonus: 0 };

/** Cell indices of every line of a board (row by row): rows, then columns, then the diagonals ↘ and ↙. */
export function sigBingoLines(size: number): number[][] {
  const idx = Array.from({ length: size }, (_, i) => i);
  return [
    ...idx.map((r) => idx.map((c) => r * size + c)),
    ...idx.map((c) => idx.map((r) => r * size + c)),
    idx.map((i) => i * size + i),
    idx.map((i) => i * size + (size - 1 - i))
  ];
}
export const sigBingoLineName = (size: number, line: number) =>
  line < size ? `가로 ${line + 1}줄` : line < size * 2 ? `세로 ${line - size + 1}줄` : line === size * 2 ? "대각선 ↘" : "대각선 ↙";

/** `opened`: who opened it (memberName null = no member — 공용 판 · 수동); `manual` = opened by the operator. */
export type SigBingoCell = { signatureId: string; signatureName: string; imageUrl: string | null; opened: { memberName: string | null; memberColor: string | null; at: string; manual: boolean } | null };
export type SigBingoBoard = {
  size: SigBingoSize;
  mode: SigBingoMode;
  reveal: SigBingoReveal;
  startedAt: string;
  cells: SigBingoCell[];
  /** Completed 빙고 lines (indices of sigBingoLines). */
  lines: number[];
  /** The cell opened last (OBS highlights it). */
  lastOpened: number | null;
};

// 복불복 뽑기판 — StreamDonate 복불복 뽑기판: a grid of hidden cells (당첨 or 꽝); a donation opens one at random, the operator
// can open any. The board resets when every cell is open (모든 칸 오픈 시 자동 리셋).
export const GRID_DRAW_TITLE_DEFAULT = "복불복 뽑기판";
export const GRID_DRAW_SIZES = [3, 4, 5, 6] as const;
export type GridDrawSize = (typeof GRID_DRAW_SIZES)[number];
export const GRID_DRAW_PRIZES_MAX = 20;
export const GRID_DRAW_LABEL_MAX = 20;
export const GRID_DRAW_POINTS_MAX = 10_000_000;

/** TEXT (문구 — 벌칙 · 미션 · 상품), SIGNATURE (시그니처, shown with its image — not played), POINTS (점수 for the opener's member). */
export type GridPrizeKind = "TEXT" | "SIGNATURE" | "POINTS";
export const GRID_PRIZE_KINDS: { key: GridPrizeKind; label: string }[] = [
  { key: "TEXT", label: "문구" },
  { key: "SIGNATURE", label: "시그니처" },
  { key: "POINTS", label: "점수" }
];
/** A 당첨 항목 taking `count` cells. `label`: the 문구 (a signature's name for SIGNATURE); `points` for POINTS (else 0). */
export type GridPrize = { id: string; kind: GridPrizeKind; label: string; signatureId: string | null; points: number; count: number };
/** Which donations open a cell automatically: SIGNATURE (시그니처 후원만) or ANY (모든 후원), from `minAmount` FN. */
export type GridDrawTrigger = "SIGNATURE" | "ANY";
export const GRID_DRAW_TRIGGERS: { key: GridDrawTrigger; label: string }[] = [
  { key: "SIGNATURE", label: "시그니처 후원만" },
  { key: "ANY", label: "모든 후원" }
];

/** `auto` = 후원 시 자동 랜덤 오픈; `autoReset` = 모든 칸 오픈 시 자동 리셋; `excluded`: signatures that open nothing. */
export type GridDrawSettings = GameCommon & { size: GridDrawSize; trigger: GridDrawTrigger; minAmount: number; autoReset: boolean; prizes: GridPrize[] };
export const DEFAULT_GRID_DRAW: GridDrawSettings = { title: "", auto: false, excluded: [], showIdle: true, size: 5, trigger: "SIGNATURE", minAmount: 0, autoReset: true, prizes: [] };

/**
 * A cell as shown. Closed cells keep their prize hidden (`kind` "HIDDEN") on OBS — the overlay is reachable with the key
 * alone; the studio sees them. "MISS" = 꽝.
 */
export type GridDrawCell = {
  kind: GridPrizeKind | "MISS" | "HIDDEN";
  label: string;
  imageUrl: string | null;
  points: number;
  /** `revealAt`: when OBS shows the prize (the opening run's result). */
  opened: { memberName: string | null; memberColor: string | null; at: string; revealAt: string; manual: boolean } | null;
};
/** `round`: boards since 뽑기판 시작; `resetAt`: a full board's 자동 리셋 (after the last result), else null. */
export type GridDrawBoard = { size: GridDrawSize; round: number; startedAt: string; cells: GridDrawCell[]; lastOpened: number | null; resetAt: string | null };

// 시그니처 헌터 — StreamDonate 시그니처 헌터: a board of signature slots per 라운드; a 시그니처 후원 buys its slot (SOLD OUT,
// × the 라운드 배수 for the member). A 몰수권 hidden in a slot takes the SOLD OUT 기여도 of the others' slots when bought.
export const SIG_HUNTER_TITLE_DEFAULT = "시그니처 헌터";
export const SIG_HUNTER_ROUNDS_MAX = 6;
export const SIG_HUNTER_SLOTS_MAX = 40;
export const SIG_HUNTER_MULTIPLIER_MAX = 10;

/**
 * A 라운드: `slots` signatures from the 금액 범위 (null = no end) in random places, the 배수 on what each slot is bought for
 * (1 = 없음) and `forfeits` 몰수권 hidden among the slots (fewer than `slots`).
 */
export type SigHunterRound = { id: string; slots: number; priceMin: number | null; priceMax: number | null; multiplier: number; forfeits: number };
/** `auto` = 시그니처 후원으로 SOLD OUT; `excluded`: signatures kept off the board. After the last 라운드 it repeats (6+). */
export type SigHunterSettings = GameCommon & { rounds: SigHunterRound[] };
export const DEFAULT_SIG_HUNTER: SigHunterSettings = {
  title: "",
  auto: false,
  excluded: [],
  showIdle: true,
  rounds: [{ id: "hr-1", slots: 10, priceMin: null, priceMax: null, multiplier: 1, forfeits: 0 }]
};

/**
 * A slot as shown. `forfeit`: a 몰수권 — on OBS only once it is sold (the studio sees it). `sold.points`: the 기여도 it
 * counts for (후원 점수 × 배수 for a member, else 0); `absorbedBy`: who took it with a 몰수권. `revealAt`: when OBS shows it.
 */
export type SigHunterSlot = {
  signatureId: string;
  signatureName: string;
  price: number;
  imageUrl: string | null;
  forfeit: boolean;
  sold: { memberName: string | null; memberColor: string | null; at: string; revealAt: string; manual: boolean; points: number; absorbedBy: string | null } | null;
};
/** `round`: 1, 2, … (past the last 라운드 its settings repeat); `advanceAt`: a sold-out board's next 라운드 (after the last result). */
export type SigHunterBoard = { round: number; multiplier: number; startedAt: string; slots: SigHunterSlot[]; lastSold: number | null; advanceAt: string | null };
/** Columns of a board of `n` slots: no more rows than columns, the fewest empty cells, then the squarest (8 → 4 × 2, 40 → 8 × 5). */
export function sigHunterColumns(n: number) {
  if (n <= 3) return Math.max(n, 1);
  const rows = (c: number) => Math.ceil(n / c);
  const empty = (c: number) => rows(c) * c - n;
  const fit = [3, 4, 5, 6, 8].filter((c) => c >= rows(c));
  return fit.sort((x, y) => empty(x) - empty(y) || Math.abs(x - rows(x)) - Math.abs(y - rows(y)))[0] ?? 8;
}

// 시그니처 두산 — StreamDonate 시그니처 두산: the picked signatures from the lowest price up are a ladder; a 시그니처 후원 of
// a lane's next one shoots it up a step. 전체: one lane for the crew · VS: A팀 / B팀 · 개인전: one per member. The first lane
// to the top wins (완주).
export const SIG_DOSAN_TITLE_DEFAULT = "시그니처 두산";
export const SIG_DOSAN_STEPS_MIN = 2;
export const SIG_DOSAN_STEPS_MAX = 20;
export const SIG_DOSAN_BONUS_MAX = 10_000_000;
export type SigDosanMode = "ALL" | "VS" | "SOLO";
export const SIG_DOSAN_MODES: { key: SigDosanMode; label: string; note: string }[] = [
  { key: "ALL", label: "전체", note: "크루 모두가 한 줄을 함께 올려요" },
  { key: "VS", label: "VS", note: "A팀 · B팀이 각자 올려요 (팀 배틀 방송)" },
  { key: "SOLO", label: "개인전", note: "멤버마다 따로 올려요" }
];
/** `signatureIds`: the picked signatures (the ladder sorts them by price); `bonus`: 완주 보너스 for the member who finishes. */
export type SigDosanSettings = GameCommon & { mode: SigDosanMode; signatureIds: string[]; bonus: number };
export const DEFAULT_SIG_DOSAN: SigDosanSettings = { title: "", auto: false, excluded: [], showIdle: true, mode: "ALL", signatureIds: [], bonus: 0 };

/** A step of the ladder (the lowest price first). */
export type SigDosanStep = { signatureId: string; signatureName: string; price: number; imageUrl: string | null };
/**
 * A lane: `key` "ALL" · "A" · "B" · a member id; `color` a member's (null for 전체 and the teams); its climbed steps in order
 * (`revealAt`: when OBS shows each).
 */
export type SigDosanLane = {
  key: string;
  label: string;
  color: string | null;
  steps: { memberName: string | null; memberColor: string | null; at: string; revealAt: string; manual: boolean }[];
};
/** `winner`: the lane that finished first (`revealAt`: when OBS shows it), after which nothing climbs. */
export type SigDosanBoard = {
  mode: SigDosanMode;
  startedAt: string;
  ladder: SigDosanStep[];
  lanes: SigDosanLane[];
  winner: { lane: string; label: string; memberName: string | null; revealAt: string } | null;
};

// 알파벳 모으기 — StreamDonate 알파벳 모으기: each 시그니처 후원 to a member spins a horizontal reel to a letter of the word or
// 꽝; each member collects the word's letters, and a completed word draws a 상품 (by 가중치).
export const ALPHABET_TITLE_DEFAULT = "알파벳 모으기";
export const ALPHABET_WORD_MIN = 2;
export const ALPHABET_WORD_MAX = 12;
export const ALPHABET_MISS_MAX = 90;
export const ALPHABET_PRIZES_MAX = 12;
export const ALPHABET_PRIZE_LABEL_MAX = 20;
export const ALPHABET_PRIZE_POINTS_MAX = 10_000_000;
export const ALPHABET_PRIZE_WEIGHT_MAX = 1000;
/** 단어판 테마 (OBS). */
export type AlphabetTheme = "NEON" | "GOLD" | "GOLD2" | "ARCADE";
export const ALPHABET_THEMES: { key: AlphabetTheme; label: string }[] = [
  { key: "NEON", label: "네온" },
  { key: "GOLD", label: "골드" },
  { key: "GOLD2", label: "골드 2" },
  { key: "ARCADE", label: "아케이드" }
];
/** A 상품 drawn for a completed word: its 문구, points for the member (0 = none) and 가중치. */
export type AlphabetPrize = { id: string; label: string; points: number; weight: number };
/** `word`: A–Z ("" until set — nothing spins); `missPercent`: 꽝 비율 of the reel (the rest is the word's letters, evenly). */
export type AlphabetSettings = GameCommon & { word: string; missPercent: number; prizes: AlphabetPrize[]; theme: AlphabetTheme };
export const DEFAULT_ALPHABET: AlphabetSettings = { title: "", auto: false, excluded: [], showIdle: true, word: "", missPercent: 50, prizes: [], theme: "NEON" };
/**
 * What happened to a member's board, in order, at the time OBS shows it: a letter filled `slot`, the word was completed
 * (the next letter starts it over) or the board was emptied.
 */
export type AlphabetEvent = { at: string; kind: "LETTER" | "DONE" | "CLEAR"; slot: number | null };
/**
 * A member's word board: each letter of the word, collected (`revealAt`: when OBS shows it) or not; `done`: 완성 so far.
 * `timeline`: its events — OBS replays them up to its clock (runs queue, so the board can be ahead of what OBS shows).
 */
export type AlphabetBoard = { memberId: string; name: string; color: string | null; slots: { letter: string; revealAt: string | null }[]; done: number; timeline: AlphabetEvent[] };

/** A board as OBS shows it at `now`: the lit letters and the 완성 count, replaying its timeline. */
export function alphabetBoardAt(board: Pick<AlphabetBoard, "slots" | "timeline">, now: number): { lit: boolean[]; done: number } {
  let lit = board.slots.map(() => false);
  let full = false;
  let done = 0;
  for (const e of board.timeline) {
    if (Date.parse(e.at) > now) break;
    if (e.kind === "DONE") {
      full = true;
      done += 1;
    } else if (e.kind === "CLEAR" || full) {
      lit = lit.map(() => false);
      full = false;
    }
    if (e.kind === "LETTER" && e.slot !== null) lit[e.slot] = true;
  }
  return { lit, done };
}

// 고스톱 — StreamDonate 고스톱: each 시그니처 후원 to a member adds to the crew's 풀 and rolls STOP (more likely the more it
// is worth, up to a 최대). GO goes on; STOP takes the 풀 × 배수 for that member and the 풀 starts over (STOP 랭킹).
export const GOSTOP_TITLE_DEFAULT = "고스톱";
export const GOSTOP_POOL_PERCENT_MAX = 1000;
export const GOSTOP_RATE_MAX = 10;
export const GOSTOP_MULTIPLIER_MAX = 10;
export const GOSTOP_BANDS_MAX = 5;
export const GOSTOP_BAND_MIN_MAX = 1_000_000_000;
/** A 색 구간: from `min` 풀 points the 풀 shows in `color` (#rrggbb). */
export type GoStopBand = { id: string; min: number; color: string };
/**
 * `poolPercent`: 적립률 — the share of a donation's points the 풀 gets; `stopRate`: STOP 확률 (%) per 1,000 of its points, up
 * to `stopMax` (%); `multiplier`: STOP 배수 on the 풀; `excludedMembers`: 제외 BJ (their donations neither add nor roll).
 */
export type GoStopSettings = GameCommon & {
  poolPercent: number;
  stopRate: number;
  stopMax: number;
  multiplier: number;
  bands: GoStopBand[];
  excludedMembers: string[];
};
export const DEFAULT_GOSTOP: GoStopSettings = {
  title: "",
  auto: false,
  excluded: [],
  showIdle: true,
  poolPercent: 100,
  stopRate: 0.05,
  stopMax: 50,
  multiplier: 1,
  bands: [],
  excludedMembers: []
};
/** STOP 랭킹: each member's STOPs among `wins`, the most points first (`best`: the biggest 풀 they took). */
export function goStopRanking(wins: { memberId: string; name: string; color: string | null; points: number; pool: number }[]) {
  const rows = new Map<string, { memberId: string; name: string; color: string | null; points: number; count: number; best: number }>();
  for (const w of wins) {
    const r = rows.get(w.memberId) ?? { memberId: w.memberId, name: w.name, color: w.color, points: 0, count: 0, best: 0 };
    rows.set(w.memberId, { ...r, points: r.points + w.points, count: r.count + 1, best: Math.max(r.best, w.pool) });
  }
  return [...rows.values()].sort((x, y) => y.points - x.points || y.count - x.count);
}
/** The 색 구간 of a 풀 (the last one it reached), or null. */
export const goStopBand = (bands: GoStopBand[], pool: number) => [...bands].sort((x, y) => x.min - y.min).filter((b) => b.min <= pool).at(-1) ?? null;

// 땅따먹기 — StreamDonate 땅따먹기: a member earns 하트 from what they receive; with a 하트 the BJ picks a cell of the N×N
// board and the operator (조정실) assigns it — an owned cell is taken over. Cells show in the owner's color; 점유 순위.
export const TERRITORY_TITLE_DEFAULT = "땅따먹기";
export const TERRITORY_SIZES = [5, 6, 7, 8, 9, 10] as const;
export type TerritorySize = (typeof TERRITORY_SIZES)[number];
export const TERRITORY_HEART_POINTS_MAX = 10_000_000;
export const TERRITORY_CELL_POINTS_MAX = 1_000_000;
/** How a member earns 하트: one per 시그니처 후원, or one per `heartPoints` points of any donation. */
export type TerritoryHeartMode = "SIGNATURE" | "AMOUNT";
export const TERRITORY_HEART_MODES: { key: TerritoryHeartMode; label: string }[] = [
  { key: "AMOUNT", label: "후원 점수마다" },
  { key: "SIGNATURE", label: "시그니처 후원 1건마다" }
];
/** `auto` = 후원으로 하트 주기; `cellPoints`: 칸 점수 — a cell's points move with it (0 = 순위만). */
export type TerritorySettings = GameCommon & { size: TerritorySize; heartMode: TerritoryHeartMode; heartPoints: number; cellPoints: number };
export const DEFAULT_TERRITORY: TerritorySettings = { title: "", auto: false, excluded: [], showIdle: true, size: 8, heartMode: "AMOUNT", heartPoints: 1_000, cellPoints: 0 };
/** A cell's label: A1 (column A, row 1) … */
export const territoryCoord = (size: number, index: number) => `${String.fromCharCode(65 + (index % size))}${Math.floor(index / size) + 1}`;
/** A cell as shown: its owners in order (`revealAt`: when OBS shows each) — the last one owns it. */
export type TerritoryCell = { owners: { memberId: string; revealAt: string }[] };
/** `boardId`: this board (a new 시작 makes another); `lastCell`: the cell assigned last. */
export type TerritoryBoard = { boardId: string; size: TerritorySize; cells: TerritoryCell[]; lastCell: number | null };

/** What started a run: a 시그니처 후원 to the member (자동), a 랜덤시그 · 메들리 발동 금액 (자동), or the operator (수동). */
/** `DONATION`: a donation that is no signature (복불복 뽑기판 on 모든 후원). */
export type GameTrigger = { kind: "SIGNATURE"; signatureName: string } | { kind: "AMOUNT"; amount: number } | { kind: "DONATION"; amount: number } | { kind: "MANUAL" };

export type GameRunView = {
  id: string;
  game: GameKey;
  at: string;
  /** When OBS starts playing it, and when the result shows — the points count from then (`at` stays their time). */
  showAt: string;
  revealAt: string;
  /** "" = no member (a 메들리 from a donation without one, or a 수동 메들리). */
  memberId: string;
  memberName: string;
  memberColor: string | null;
  trigger: GameTrigger;
  /** The 기준 후원's points when the run was drawn (0 = none). */
  basePoints: number;
  /** The result as shown: a 스핀머신 item's name, "4 + 4 더블", "+3", "×2". */
  label: string;
  kind: GameEffect;
  value: number;
  /** Points the result adds (MULTIPLY · ADD); 0 for TEXT · MISS. */
  points: number;
  /** 스핀머신: the drawn item. 주사위: the two dice. 투휠: the operator and the number. 랜덤시그: the signature and its 발동 구간 range. */
  itemId: string | null;
  dice: [number, number] | null;
  wheel: { op: "ADD" | "MULTIPLY"; n: number } | null;
  range: [number, number] | null;
  /** 기여도 릴레이: the 트리거 후원 the 배수 came from. 줍줍: the stacked 후원 that was taken. */
  from: { memberName: string; amount: number } | null;
  /** Points the run moves for other members (시그니처 헌터 몰수권: what each one loses), counted with the run. */
  shares: { memberName: string; memberColor: string | null; points: number }[];
  /** 고스톱: the 풀 after the run (a STOP: the 풀 it took), the GO count, and the STOP 확률 it rolled (%). */
  gostop: { pool: number; go: number; chance: number } | null;
};

/** 스핀머신 BJ별 집계: how many times each member got each 문구 (TEXT) result, columns in first-seen order. */
export type SpinTally = { columns: string[]; rows: { memberId: string; name: string; color: string | null; counts: number[]; total: number }[] };

export type SpinLive = { settings: SpinSettings; runs: GameRunView[]; tally: SpinTally };
export type DiceLive = { settings: DiceSettings; runs: GameRunView[] };
export type TwoWheelLive = { settings: TwoWheelSettings; runs: GameRunView[] };
/** `board`: null until 뽑기판 시작 (or after 판 비우기). */
export type GridDrawLive = { settings: GridDrawSettings; runs: GameRunView[]; board: GridDrawBoard | null };
/** `board`: null until 헌트 시작 (or after 판 비우기). */
export type SigHunterLive = { settings: SigHunterSettings; runs: GameRunView[]; board: SigHunterBoard | null };
/** `boards`: the active members' (and anyone's who collected); `letters`: the word's letters, as on the reel. */
export type AlphabetLive = { settings: AlphabetSettings; runs: GameRunView[]; boards: AlphabetBoard[]; letters: string[] };
/**
 * `pool` · `go`: now (OBS shows the latest result's — runs queue); `wins`: every STOP of the broadcast, oldest first
 * (`revealAt`: when OBS shows it), for the STOP 랭킹.
 */
export type GoStopLive = {
  settings: GoStopSettings;
  runs: GameRunView[];
  pool: number;
  go: number;
  wins: { memberId: string; name: string; color: string | null; points: number; pool: number; go: number; at: string; revealAt: string }[];
};
/** `board`: null until 판 시작 (or after 판 비우기); `members`: the crew's names, colors and unused 하트. */
export type TerritoryLive = {
  settings: TerritorySettings;
  runs: GameRunView[];
  board: TerritoryBoard | null;
  members: { memberId: string; name: string; color: string | null; active: boolean; hearts: number }[];
};
/** `board`: null until 두산 시작 (or after 판 비우기). */
export type SigDosanLive = { settings: SigDosanSettings; runs: GameRunView[]; board: SigDosanBoard | null };
/** `board`: null until 빙고 시작 (or after 판 비우기); `eligible`: how many signatures a new board would draw from. */
export type SigBingoLive = { settings: SigBingoSettings; runs: GameRunView[]; board: SigBingoBoard | null; eligible: number };
/** `pool`: the registered signatures that can be drawn (active) — the OBS rolling images. */
export type MedleyLive = { settings: MedleySettings; runs: GameRunView[]; pool: { id: string; name: string; price: number; imageUrl: string }[] };
/** `stack`: oldest first (up to JUPJUP_STACK_SHOWN of `stackCount`); `ownerNames`: the 지정 BJ. */
export type JupjupLive = { settings: JupjupSettings; runs: GameRunView[]; stack: JupjupStackItem[]; stackCount: number; ownerNames: string[] };
/** `pending`: the 배수 waiting for the next 시그니처 후원 (from the 트리거 BJ's last one); `triggerName`: the 트리거 BJ. */
export type RelayLive = { settings: RelaySettings; runs: GameRunView[]; pending: { multiplier: number; amount: number; at: string } | null; triggerName: string | null };
/** `pool`: the signatures a 랜덤시그 can draw (active, not excluded) — the OBS rolling images. */
export type RandomSigLive = { settings: RandomSigSettings; runs: GameRunView[]; pool: { id: string; name: string; price: number; imageUrl: string }[] };

/** A donation a member received in the broadcast, offered as the 기준 후원 of a 수동 run (studio only: names as sent). */
export type GameSource = { id: string; at: string; label: string; points: number };

/** `/creator/crew/games` (점수 게임). `sources`: per game, each active member's donations not yet used by that game. */
export type GamesView = {
  members: CrewMember[];
  live: {
    id: string;
    title: string;
    spin: SpinLive;
    dice: DiceLive;
    twoWheel: TwoWheelLive;
    randomSig: RandomSigLive;
    relay: RelayLive;
    jupjup: JupjupLive;
    medley: MedleyLive;
    sigBingo: SigBingoLive;
    gridDraw: GridDrawLive;
    sigHunter: SigHunterLive;
    sigDosan: SigDosanLive;
    alphabet: AlphabetLive;
    gostop: GoStopLive;
    territory: TerritoryLive;
    sources: Record<GameKey, Record<string, GameSource[]>>;
    serverNow: string;
  } | null;
  spinSettings: SpinSettings;
  diceSettings: DiceSettings;
  twoWheelSettings: TwoWheelSettings;
  randomSigSettings: RandomSigSettings;
  relaySettings: RelaySettings;
  jupjupSettings: JupjupSettings;
  medleySettings: MedleySettings;
  sigBingoSettings: SigBingoSettings;
  gridDrawSettings: GridDrawSettings;
  sigHunterSettings: SigHunterSettings;
  sigDosanSettings: SigDosanSettings;
  alphabetSettings: AlphabetSettings;
  gostopSettings: GoStopSettings;
  territorySettings: TerritorySettings;
  signatures: { id: string; name: string; group: string; active: boolean; price: number; match: "SELECT" | "AMOUNT"; rangeMin: number | null }[];
  overlayPath: string;
};

export type GamePlayResult = { status: "PLAYED"; run: GameRunView } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

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

/** 콘텐츠 시나리오 as the OBS overlay gets it: what it shows (부 이름 · 예정 시간), never the operator's 메모. */
export type OverlayScenario = Omit<ScenarioLive, "parts"> & { parts: Pick<ScenarioPart, "title" | "minutes">[] };

/** The crew scoreboard as the OBS overlay gets it (the URL key alone opens it; see getOverlayScoreboard). */
export type OverlayScoreboard = Omit<BroadcastLive, "scenario"> & { scenario: OverlayScenario | null };

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

/**
 * MEMBERS: one BJ against another. TEAMS: the broadcast's A팀 vs B팀 (team mode only). MULTI_TEAMS (다수 팀, 2026-10-23):
 * 2 ~ 8 teams made for this battle. PAIRS (1:1 여러 쌍, 2026-10-23): up to 12 BJ 1:1 matches at once. StreamDonate 다수 팀
 * VS 참고 (docs/research/streamdonate-reference.md P1-2).
 */
export type BattleMode = "MEMBERS" | "TEAMS" | "MULTI_TEAMS" | "PAIRS";
export const BATTLE_MODES: { key: BattleMode; label: string }[] = [
  { key: "MEMBERS", label: "BJ 1:1" },
  { key: "TEAMS", label: "A팀 vs B팀" },
  { key: "MULTI_TEAMS", label: "다수 팀" },
  { key: "PAIRS", label: "1:1 여러 쌍" }
];
export const MULTI_TEAMS_MIN = 2;
export const MULTI_TEAMS_MAX = 8;
export const BATTLE_TEAM_NAME_MAX = 10;
export const BATTLE_PAIRS_MAX = 12;
/** 다수 팀 keys and colors in team order (blank names become "A팀", "B팀" …). */
export const MULTI_TEAM_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export const MULTI_TEAM_COLORS = ["#3b82f6", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#84cc16"] as const;

/** `key`: A, B … in the order the sides were set up. `memberNames` follows `memberIds` (removed members: 삭제된 멤버). */
export type BattleSide = { key: string; label: string; color: string; memberIds: string[]; memberNames: string[]; score: number };

/**
 * One match of a battle, sides in set-up order. `leader`: the side with the most points (DRAW when the top is shared, null
 * while nobody has points). `loser`: the side with the fewest — the one that does the 벌칙 — or null when that is shared or
 * every side has the same score.
 */
export type BattleMatch = { sides: BattleSide[]; leader: string | "DRAW" | null; loser: string | null };

/** A match's `leader` and `loser` from its sides' scores (see BattleMatch). */
export function battleStanding(sides: Pick<BattleSide, "key" | "score">[]): Pick<BattleMatch, "leader" | "loser"> {
  const scores = sides.map((s) => s.score);
  if (scores.every((s) => s === 0)) return { leader: null, loser: null };
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const only = (v: number) => (scores.filter((s) => s === v).length === 1 ? sides[scores.indexOf(v)].key : null);
  return { leader: only(max) ?? "DRAW", loser: max === min ? null : only(min) };
}

/**
 * Score of a side = points its members received while the battle runs (same 자동엑셀 points as the
 * scoreboard, 보정 excluded) × the battle's 배수. The main scoreboard counts those points × 배수 too (2026-10-05 결정;
 * see ScoreRow.battle). The battle ends when time runs out or the operator stops it; the losing side of each match does
 * the 벌칙 (empty = 벌칙 없음) — in 다수 팀 the last team, in 1:1 여러 쌍 the loser of every pair.
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
  /** One match, except 1:1 여러 쌍 (one per pair). */
  matches: BattleMatch[];
  multiplier: number;
  penalty: string;
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
  /** 상품 순위표 settings (kept across broadcasts; editable before going live). */
  prizeSettings: PrizeBoardSettings;
  /** 시그 카운트 settings (kept across broadcasts) and the signatures it can count (숨긴 시그니처 too, marked). */
  sigCountSettings: SigCountSettings;
  signatures: { id: string; name: string; group: string; active: boolean; price: number; match: "SELECT" | "AMOUNT"; rangeMin: number | null }[];
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
