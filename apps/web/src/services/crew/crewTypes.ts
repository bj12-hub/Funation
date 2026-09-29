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

/** `donatedFn` = member-targeted donations; `feedFn` = 후원 리스트 entries assigned to the member. */
export type ScoreRow = { memberId: string; name: string; color: string; team: TeamKey | null; donatedFn: number; feedFn: number; adjust: number; score: number };

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
  fnAmount: number;
  source: FeedSource;
  status: FeedStatus;
  memberId: string | null;
  /** Keyword match (shown for PENDING entries). */
  suggestedMemberId: string | null;
  /** Given through a 한방 (badge). */
  oneshot: boolean;
};

export type FeedView = {
  assignMode: AssignMode;
  keywords: Record<string, string[]>;
  /** Newest first. */
  entries: FeedEntry[];
  oneshot: { startedAt: string; potFn: number; count: number } | null;
};
export type ScoreLog = { id: string; at: string; memberName: string; points: number; reason: string };

export type BroadcastLive = {
  id: string;
  title: string;
  /** 프로젝트 (preset) name and its auto-numbered 회차. */
  project: string | null;
  round: number | null;
  /** FN collected by an active 한방 window (shown on the overlay). */
  oneshotPot: number | null;
  startedAt: string;
  teamMode: boolean;
  rows: ScoreRow[];
  teams: { key: TeamKey; score: number }[];
  logs: ScoreLog[];
};

export type BroadcastSummary = { id: string; title: string; project: string | null; round: number | null; startedAt: string; endedAt: string; totalScore: number; winner: string | null; top: { name: string; score: number }[] };

export type BroadcastView = {
  members: CrewMember[];
  live: BroadcastLive | null;
  /** Only while live; never sent to the overlay (donor messages stay in the studio). */
  feed: FeedView | null;
  keywords: Record<string, string[]>;
  /** Existing project names (for the start form). */
  projects: string[];
  history: BroadcastSummary[];
  overlayPath: string;
};

export type BroadcastResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

export const crewRoleLabel = (r: CrewRole) => CREW_ROLES.find((x) => x.key === r)!.label;
