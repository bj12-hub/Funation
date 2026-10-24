import type {
  AssignMode,
  BattleRules,
  CrewGrade,
  FanNoteRules,
  CrewMember,
  ExcelSettings,
  FeedEntry,
  DiceSettings,
  GameEffect,
  GameKey,
  GridDrawSettings,
  GridDrawSize,
  GridPrizeKind,
  SigHunterSettings,
  AlphabetEvent,
  AlphabetSettings,
  GoStopSettings,
  TerritorySettings,
  TerritorySize,
  SigDosanMode,
  SigDosanSettings,
  JupjupSettings,
  MedleySettings,
  SigBingoMode,
  SigBingoReveal,
  SigBingoSettings,
  SigBingoSize,
  PrizeBoardSettings,
  RandomSigSettings,
  RelaySettings,
  ScenarioPart,
  SigCountSettings,
  SpinSettings,
  StealRules,
  StealSlot,
  TwoWheelSettings
} from "./crewTypes";

/**
 * Development-only crew state, keyed by channel id: the studio creator's own channel
 * (`STUDIO_CHANNEL`) and one room creator (c4) so member targeting can be tried in a creator room.
 * `attributions` records which member a completed donation was sent for. Seed amounts give the
 * studio ranking some rows; they did not debit anyone. c4 starts with a live broadcast so the room's
 * 팬 메시지 · 요청사항 card can be tried from `/creators/c4` (the studio channel has no public room in the mock).
 */

export const STUDIO_CHANNEL = "studio";

/**
 * `donor` · `donorId` · `message`: what the 크루 후원 list shows (donorId is empty for a hidden profile) — the name as
 * sent. `shownDonor`: the name for anything on stream (2026-10-09 결정) — after the creator's 대체 메시지 rules (익명 or
 * the 대체 문구), fixed when the donation was sent, so a later 금지어 change does not rewrite it.
 */
type Attribution = { donationId: string; channelId: string; memberId: string; fnAmount: number; at: string; donor?: string; donorId?: string; message?: string; shownDonor: string };

export type MockBroadcast = {
  id: string;
  /** The start request (a retried start returns SAVED instead of a second broadcast); missing on the seed. */
  requestId?: string;
  channelId: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  teamMode: boolean;
  teams: Record<string, "A" | "B">;
  adjustments: { id: string; at: string; memberId: string; points: number; reason: string }[];
  project?: string | null;
  round?: number | null;
  assignMode?: AssignMode;
  /** 후원 리스트 (newest last). */
  feed?: FeedEntry[];
  /** Active 한방 window. */
  oneshot?: { startedAt: string } | null;
  /**
   * 직급 배수 per member (≠ 1) when the broadcast started. Grade edits apply from the next broadcast, so points
   * already moved (기여도 강탈) never rest on a 배수 that changed afterwards. Missing on broadcasts from before.
   */
  gradeMultipliers?: Record<string, number>;
  /** 랭크업 on the OBS scoreboard (2026-10-06). */
  showRankUp?: boolean;
  /** 시뮬 후원 request ids already accepted. */
  simRequests?: string[];
  /** 서브 점수판: window-scored boards under the main one (numbered from 1 per broadcast). */
  subBoards?: { no: number; title: string; openedAt: string; closedAt: string | null; requestId: string }[];
  /**
   * 실시간 배틀: side A/B member ids (BJ 1:1 · A팀 vs B팀), `teams` (다수 팀) or `pairs` (1:1 여러 쌍), timer and the request
   * ids already applied (start · time changes). Read through crewCore.battleGroups.
   */
  battles?: {
    no: number;
    title: string;
    mode: "MEMBERS" | "TEAMS" | "MULTI_TEAMS" | "PAIRS";
    a: string[];
    b: string[];
    teams?: { name: string; memberIds: string[] }[];
    pairs?: [string, string][];
    startedAt: string;
    endsAt: string;
    stoppedAt: string | null;
    requests: string[];
    /** 배수 · 벌칙 chosen at the start (missing on battles from before 2026-10-05 = 1배 · 없음). */
    multiplier?: number;
    penalty?: string;
  }[];
  /** 기여도 강탈: points moved from `target` to `thief` (request id = record id, so a retry returns the same spin). */
  steals?: { id: string; at: string; thief: string; target: string; slotId: string; slotLabel: string; points: number }[];
  /**
   * 점수 게임 runs (oldest first): the result and its points, fixed when drawn; `showAt` · `revealAt` queue them on OBS.
   * `sourceId`: the 기준 후원 (attribution donation id or 후원 리스트 entry id) — one run per donation and game.
   * `itemId` (스핀머신 item · 랜덤시그 signature) · `dice` (주사위) · `wheel` (투휠) · `range` (랜덤시그 발동 구간) · `from` (기여도 릴레이 트리거 후원): what was drawn.
   */
  gameRuns?: {
    id: string;
    game: GameKey;
    at: string;
    showAt: string;
    revealAt: string;
    memberId: string;
    trigger: { kind: "SIGNATURE"; signatureId: string; signatureName: string } | { kind: "AMOUNT"; amount: number } | { kind: "DONATION"; amount: number } | { kind: "MANUAL" };
    sourceId: string | null;
    basePoints: number;
    itemId: string | null;
    dice?: [number, number];
    wheel?: { op: "ADD" | "MULTIPLY"; n: number };
    range?: [number, number];
    from?: { memberId: string; amount: number };
    /** Points the run moves for other members (시그니처 헌터 몰수권), counted with the run. */
    shares?: { memberId: string; points: number }[];
    /** 고스톱: the 풀 after the run (a STOP: the 풀 it took), the GO count and the STOP 확률 rolled (per million). */
    gostop?: { pool: number; go: number; chance: number };
    label: string;
    kind: GameEffect;
    value: number;
    points: number;
  }[];
  /** 콘텐츠 시나리오 progress: plan snapshot, running part and part history (request ids dedupe 다음 부로). */
  scenario?: { parts: ScenarioPart[]; current: number | null; history: { index: number; startedAt: string; endedAt: string | null }[]; requests: string[] };
  /** 팬 메시지 · 요청사항 from the room (newest last); `userId` never leaves the server. */
  fanNotes?: { id: string; at: string; userId: string; author: string; kind: "MESSAGE" | "REQUEST"; memberId: string | null; text: string; status: "NEW" | "DONE" | "HIDDEN"; requestId: string }[];
  /** 팬 메시지 받기 꺼짐 (open by default). */
  fanNotesClosed?: boolean;
  /** 기여도 릴레이: the 배수 waiting for the next 시그니처 후원 (set by the 트리거 BJ's last one, taken once). */
  relay?: { pending: { multiplier: number; amount: number; at: string; donationId: string } | null };
  /**
   * 줍줍 stack (oldest first): the 지정 BJ's 시그니처 후원 waiting to be taken. `donationId` null = 수동 추가 (its request id
   * is the item id, so a retried add is not a second item).
   */
  jupjup?: { stack: { id: string; at: string; memberId: string; signatureId: string; signatureName: string; amount: number; donationId: string | null }[] };
  /**
   * 시그 빙고 board (빙고 시작 replaces it): settings as they were at the start, the cells row by row with who opened them,
   * the completed lines and the cell opened last. `requestId`: the start request (a retried start is not a new board).
   */
  sigBingo?: {
    size: SigBingoSize;
    mode: SigBingoMode;
    reveal: SigBingoReveal;
    startedAt: string;
    requestId: string;
    cells: { signatureId: string; signatureName: string; opened: { memberId: string | null; at: string; donationId: string | null } | null }[];
    lines: number[];
    lastOpened: number | null;
  };
  /**
   * 복불복 뽑기판 board: the prizes placed at 시작 (MISS = 꽝) and who opened each cell (`revealAt`: its run's result). `round`
   * counts the boards since 시작; `resetAt`: set when the last cell opens with 자동 리셋 on — the next board replaces this one
   * then (or at the next opening). `requestId`: the start request (a retried start is not a new board).
   */
  gridDraw?: {
    size: GridDrawSize;
    round: number;
    startedAt: string;
    requestId: string;
    cells: {
      kind: GridPrizeKind | "MISS";
      label: string;
      signatureId: string | null;
      points: number;
      opened: { memberId: string | null; at: string; revealAt: string; donationId: string | null } | null;
    }[];
    lastOpened: number | null;
    resetAt: string | null;
  };
  /**
   * 시그니처 헌터 board (the current 라운드; 헌트 시작 replaces it): its slots — the signature, a hidden 몰수권, and who bought
   * it (`points`: the 기여도 a 몰수권 can take; `absorbedBy`: who took it). `multiplier`: the 라운드 배수 as it was at its
   * start. `advanceAt`: set when the last slot sells — the next 라운드 replaces this one then (or at the next sale).
   * `requestId`: the start request (a retried start is not a new hunt).
   */
  sigHunter?: {
    requestId: string;
    startedAt: string;
    round: number;
    multiplier: number;
    slots: {
      signatureId: string;
      forfeit: boolean;
      sold: { memberId: string | null; at: string; revealAt: string; donationId: string | null; points: number; absorbedBy: string | null } | null;
    }[];
    lastSold: number | null;
    advanceAt: string | null;
  };
  /**
   * 시그니처 두산 board (두산 시작 replaces it): the mode and the ladder (signature ids, the lowest price first) as they were
   * at the start, each lane's climbed steps (`lanes` by "ALL" · "A" · "B" · member id) and the lane that finished first.
   * `requestId`: the start request (a retried start is not a new board).
   */
  sigDosan?: {
    requestId: string;
    startedAt: string;
    mode: SigDosanMode;
    ladder: string[];
    lanes: Record<string, { memberId: string | null; at: string; revealAt: string; donationId: string | null }[]>;
    winner: { lane: string; memberId: string | null; revealAt: string } | null;
  };
  /**
   * 알파벳 모으기 progress for `word` (another word starts over): per member, which letters of the word they collected
   * (`revealAt` of the run that brought each), how many words they completed, and `full` while the last one is complete
   * (it starts over with their next letter). `log`: the board's events at their OBS times (AlphabetBoard.timeline).
   */
  alphabet?: { word: string; members: Record<string, { slots: ({ revealAt: string } | null)[]; done: number; full: boolean; log: AlphabetEvent[] }> };
  /** 고스톱: the crew's 풀 and GO count now (a STOP's own record is its run). */
  gostop?: { pool: number; go: number };
  /**
   * 땅따먹기 board (판 시작 replaces it): each cell's owners in order (`revealAt`: when OBS shows each), and the 하트 log —
   * what each member earned (`donationId`, one entry per donation) or the operator added or took (`requestId`). Unused 하트 =
   * the log's sum − the cells assigned to the member.
   */
  territory?: {
    boardId: string;
    size: TerritorySize;
    cells: { owners: { memberId: string; at: string; revealAt: string }[] }[];
    lastCell: number | null;
    hearts: { memberId: string; hearts: number; at: string; donationId: string | null; requestId: string | null }[];
  };
  /** 상품 순위표: shown on OBS (`?prize`) and its 구간 (시작 ~ 정지; a new 시작 restarts it). `starts`: 시작 request ids applied. */
  prizeBoard?: { visible: boolean; window: { startedAt: string; stoppedAt: string | null } | null; starts: string[] };
  /** 시그 카운트: shown on OBS (`?sigcount`) and counted from `since` (null = the broadcast start; 다시 세기 sets it). */
  sigCount?: { visible: boolean; since: string | null; resets: string[] };
  /** Final ranking frozen at the end (members may be renamed or removed later). */
  final: { memberId: string; name: string; score: number }[] | null;
};

type MockCrew = {
  crews: Record<string, CrewMember[]>;
  attributions: Attribution[];
  broadcasts?: MockBroadcast[];
  /** 후원 리스트 keywords per member id (kept across broadcasts). */
  keywords?: Record<string, string[]>;
  /** 자동엑셀 settings per channel (kept across broadcasts). */
  excel?: Record<string, ExcelSettings>;
  /** 기여도 강탈 룰렛 slots per channel. */
  stealSlots?: Record<string, StealSlot[]>;
  /** 강탈 기준 · 쿨다운 per channel (missing = platform defaults). */
  stealRules?: Record<string, StealRules>;
  /** 팬 메시지 도배 기준 per channel (missing = platform defaults; 2026-10-06). */
  fanNoteRules?: Record<string, FanNoteRules>;
  /** 배틀 배수 · 벌칙 defaults per channel (missing = platform defaults). */
  battleRules?: Record<string, BattleRules>;
  /** 콘텐츠 시나리오 plan per channel. */
  scenario?: Record<string, ScenarioPart[]>;
  /** 직급 per channel (missing = none). */
  grades?: Record<string, CrewGrade[]>;
  /** 상품 순위표 settings per channel (missing = DEFAULT_PRIZE_BOARD). */
  prizeBoards?: Record<string, PrizeBoardSettings>;
  /** 시그 카운트 settings per channel (missing = DEFAULT_SIG_COUNT). */
  sigCounts?: Record<string, SigCountSettings>;
  /** 스핀머신 settings per channel (missing = DEFAULT_SPIN). */
  spinMachines?: Record<string, SpinSettings>;
  /** 주사위 게임 · 투휠 게임 settings per channel (missing = DEFAULT_DICE · DEFAULT_TWO_WHEEL). */
  diceGames?: Record<string, DiceSettings>;
  twoWheels?: Record<string, TwoWheelSettings>;
  /** 랜덤시그 settings per channel (missing = DEFAULT_RANDOM_SIG). */
  randomSigs?: Record<string, RandomSigSettings>;
  /** 기여도 릴레이 settings per channel (missing = DEFAULT_RELAY). */
  relays?: Record<string, RelaySettings>;
  /** 줍줍 settings per channel (missing = DEFAULT_JUPJUP). */
  jupjups?: Record<string, JupjupSettings>;
  /** 시그니처 메들리 settings per channel (missing = DEFAULT_MEDLEY). */
  medleys?: Record<string, MedleySettings>;
  /** 시그 빙고 settings per channel (missing = DEFAULT_SIG_BINGO). */
  sigBingos?: Record<string, SigBingoSettings>;
  /** 복불복 뽑기판 settings per channel (missing = DEFAULT_GRID_DRAW). */
  gridDraws?: Record<string, GridDrawSettings>;
  /** 시그니처 헌터 settings per channel (missing = DEFAULT_SIG_HUNTER). */
  sigHunters?: Record<string, SigHunterSettings>;
  /** 시그니처 두산 settings per channel (missing = DEFAULT_SIG_DOSAN). */
  sigDosans?: Record<string, SigDosanSettings>;
  /** 알파벳 모으기 settings per channel (missing = DEFAULT_ALPHABET). */
  alphabets?: Record<string, AlphabetSettings>;
  /** 고스톱 settings per channel (missing = DEFAULT_GOSTOP). */
  gostops?: Record<string, GoStopSettings>;
  /** 땅따먹기 settings per channel (missing = DEFAULT_TERRITORY). */
  territories?: Record<string, TerritorySettings>;
  /** 멤버 추가 request ids already applied (a retried add is not a second member). */
  memberRequests?: string[];
};

const m = (id: string, name: string, role: CrewMember["role"], color: string, active = true): CrewMember => ({ id, name, role, active, color });

function monthStamp(dayOffset: number) {
  const d = new Date();
  d.setDate(Math.max(1, d.getDate() - dayOffset));
  return d.toISOString();
}

// V2: attributions and 후원 리스트 entries carry `shownDonor`, the name on stream (2026-10-09 결정).
const g = globalThis as typeof globalThis & { __ssumnationMockCrewV2?: MockCrew };

export const mockCrew = (g.__ssumnationMockCrewV2 ??= {
  crews: {
    [STUDIO_CHANNEL]: [m("cm-s1", "길동", "LEADER", "#8b5cf6"), m("cm-s2", "하늘", "MEMBER", "#ec4899"), m("cm-s3", "바다", "MEMBER", "#3b82f6"), m("cm-s4", "솔", "MEMBER", "#f59e0b", false)],
    c4: [m("cm-c4-1", "재형", "LEADER", "#8b5cf6"), m("cm-c4-2", "용주", "MEMBER", "#10b981"), m("cm-c4-3", "민수", "MEMBER", "#3b82f6")]
  },
  broadcasts: [
    { id: "bc-seed-c4", channelId: "c4", title: "크루 엑셀 방송", startedAt: new Date(Date.now() - 40 * 60_000).toISOString(), endedAt: null, teamMode: false, teams: {}, adjustments: [], final: null }
  ],
  attributions: [
    { donationId: "seed-1", channelId: STUDIO_CHANNEL, memberId: "cm-s2", fnAmount: 50_000, at: monthStamp(2), donor: "별빛소나타", donorId: "star_sonata", message: "하늘님 오늘 노래 최고였어요!", shownDonor: "별빛소나타" },
    { donationId: "seed-2", channelId: STUDIO_CHANNEL, memberId: "cm-s1", fnAmount: 30_000, at: monthStamp(3), donor: "우주비행사", donorId: "space_runner", message: "길동 리더 화이팅", shownDonor: "우주비행사" },
    { donationId: "seed-3", channelId: STUDIO_CHANNEL, memberId: "cm-s3", fnAmount: 12_000, at: monthStamp(1), donor: "치즈냥", donorId: "cheese_cat", message: "바다님 리액션 귀여워요 ㅋㅋ", shownDonor: "치즈냥" },
    { donationId: "seed-4", channelId: STUDIO_CHANNEL, memberId: "cm-s2", fnAmount: 8_000, at: monthStamp(0), donor: "익명", donorId: "", message: "응원합니다", shownDonor: "익명" }
  ]
});
