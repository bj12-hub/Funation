/**
 * 이벤트 — code-first, no Figma frame (docs/figma/code-first-screens.md). Reference:
 * docs/research/funnation-reference.md §1. Rewards (2026-10-08 결정): an operator sets one per event in the console and,
 * after the event, pays it or draws the winners (services/admin/events.ts). Eligibility, 경품 고시 · 제세공과금 and how a
 * prize is delivered are TBD.
 */

export const EVENT_FILTERS = [
  { key: "all", label: "전체" },
  { key: "ongoing", label: "진행 중" },
  { key: "upcoming", label: "예정" },
  { key: "ended", label: "종료" },
  { key: "mine", label: "내 참여" }
] as const;
export type EventFilter = (typeof EVENT_FILTERS)[number]["key"];
export const isEventFilter = (v: unknown): v is EventFilter => EVENT_FILTERS.some((f) => f.key === v);

const kstDay = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });

/**
 * "2026. 10. 3. ~ 2026. 10. 22." — event days are Korean days, so the label is formatted in KST: the server render and
 * the browser (the detail screen is a client component) agree whatever zone the viewer is in.
 */
export const eventPeriodLabel = (startsAt: string, endsAt: string) => `${kstDay(startsAt)} ~ ${kstDay(endsAt)}`;

export type EventPhase = "ongoing" | "upcoming" | "ended";
export const PHASE_LABEL: Record<EventPhase, string> = { ongoing: "진행 중", upcoming: "예정", ended: "종료" };

export type EventSummary = { id: string; title: string; summary: string; startsAt: string; endsAt: string; phase: EventPhase; joined: boolean; participants: number; emoji: string };
/**
 * 이벤트 보상 (2026-10-08 결정), set per event by an operator: FREE_FN = 참여자 전원 무상 FN (the amount the operator
 * enters — there is no default), DRAW = 추첨 N명 경품 (the winner count and prize text the operator enters).
 */
export type EventReward = { kind: "FREE_FN"; amountFn: number } | { kind: "DRAW"; winners: number; prize: string };
/** Form bounds — sanity limits on what an operator types, not business rules (TBD). */
export const EVENT_REWARD_LIMITS = { amountMaxFn: 10_000_000, winnersMax: 1_000, prizeMin: 2, prizeMax: 100 } as const;
/** After the event: 보상 지급 (FREE_FN) or 당첨자 발표 with the winners' masked nicknames (DRAW). */
export type EventOutcome = { kind: "FREE_FN"; at: string } | { kind: "DRAW"; at: string; winners: string[] };
/**
 * The signed-in viewer's own result once the outcome is out (they joined). UNPAID (2026-10-09 결정): the person had
 * withdrawn when the operator paid or drew, so they were skipped as 지급 불가 — seen from their 재가입 account.
 */
export type MyEventResult = { kind: "PAID"; amountFn: number } | { kind: "WON" } | { kind: "NOT_WON" } | { kind: "UNPAID" };

/** The viewer's own result line on `/events/[id]` (2026-10-08 · 2026-10-09 결정). */
export const myEventResultText = (r: MyEventResult) =>
  r.kind === "PAID"
    ? `보상 ${r.amountFn.toLocaleString("ko-KR")} FN을 받았어요`
    : r.kind === "WON"
      ? "당첨됐어요"
      : r.kind === "UNPAID"
        ? "탈퇴한 계정으로 참여해 보상 대상에서 빠졌어요"
        : "아쉽지만 당첨되지 않았어요";

/** "참여자 전원에게 무상 FN 1,000 FN을 드려요." / "참여자 중 3명을 추첨해 경품을 드려요." */
export const eventRewardText = (r: EventReward) =>
  r.kind === "FREE_FN" ? `참여자 전원에게 무상 FN ${r.amountFn.toLocaleString("ko-KR")} FN을 드려요.` : `참여자 중 ${r.winners.toLocaleString("ko-KR")}명을 추첨해 경품을 드려요.`;

/**
 * `rewardNote`: the TBD line the screen shows while no reward is set. `reward` · `outcome` · `myResult` are null until an
 * operator sets the reward / pays or draws / the viewer has a result.
 */
export type EventDetail = EventSummary & { body: string; rewardNote: string; reward: EventReward | null; outcome: EventOutcome | null; myResult: MyEventResult | null };
export type EventListView = { filter: EventFilter; items: EventSummary[]; signedIn: boolean };
export type JoinResult = { status: "JOINED" } | { status: "NOT_OPEN" | "NOT_FOUND" | "UNAUTHORIZED" };
