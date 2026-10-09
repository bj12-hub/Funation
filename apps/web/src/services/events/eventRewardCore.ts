import { ownEntry } from "@/lib/records";
import { MOCK_FORBIDDEN_WORDS, mockAccount, mockCredentials } from "@/services/account/mockStore";
import { accountSince, isWithdrawn, withdrawnAccounts } from "@/services/account/withdrawalCore";
import { EVENT_REWARD_LIMITS, type EventOutcome, type EventReward, type MyEventResult } from "./eventTypes";

/**
 * 이벤트 보상 (2026-10-08 결정) — server-only state shared by the site (./events.ts) and the console (admin/events.ts);
 * not a "use server" module and no Node built-ins (the random draw is in ./eventDraw.ts).
 *
 * An operator sets one reward per event: 참여자 전원 무상 FN (an amount the operator enters, no default) or 추첨 N명
 * 경품 (a winner count and prize text the operator enters). After the event ends, 보상 지급 credits each participant's
 * current account once as free FN (refund-excluded, like 출석 보상), or 당첨자 추첨 draws the winners on the server.
 * Participants are people (the person key, 2026-10-08 rule): a person is paid through the account that belongs to them
 * now; a person with no account now (withdrawn, no new account) is skipped and listed as 지급 불가.
 * TBD: eligibility, 경품 고시 · 제세공과금, how a prize is delivered.
 */

export type RewardSetting = EventReward & { updatedAt: string; updatedBy: string };
/** `account`: the start marker (`accountSince`) of the account the person had at the time — who was credited / won. */
export type PaidEntry = { person: string; account: string | null; amountFn: number };
export type WinnerEntry = { person: string; account: string | null; masked: string };
/** 지급 불가: the person had no account. `last`: their latest withdrawn account, null when it can no longer be found. */
export type UnpaidEntry = { person: string; last: { account: string | null } | null };

export type EventResultRecord =
  | { kind: "FREE_FN"; at: string; by: string; requestId: string; amountFn: number; paid: PaidEntry[]; unpaid: UnpaidEntry[] }
  | { kind: "DRAW"; at: string; by: string; requestId: string; winnersWanted: number; prize: string; pool: number; winners: WinnerEntry[]; unpaid: UnpaidEntry[] };

type Store = { rewards: Record<string, RewardSetting>; results: Record<string, EventResultRecord> };
const g = globalThis as typeof globalThis & { __ssumnationMockEventRewardsV1?: Store };
export const rewardStore = (): Store => (g.__ssumnationMockEventRewardsV1 ??= { rewards: {}, results: {} });

export const rewardOf = (eventId: string): RewardSetting | null => ownEntry(rewardStore().rewards, eventId) ?? null;
export const resultOf = (eventId: string): EventResultRecord | null => ownEntry(rewardStore().results, eventId) ?? null;

/** The reward without who set it (what the site shows). */
export const plainReward = (r: EventReward): EventReward => (r.kind === "FREE_FN" ? { kind: "FREE_FN", amountFn: r.amountFn } : { kind: "DRAW", winners: r.winners, prize: r.prize });
export const sameReward = (a: EventReward, b: EventReward) => JSON.stringify(plainReward(a)) === JSON.stringify(plainReward(b));

/**
 * The account that belongs to this person now (the mock has one account slot: its account while it is active and the
 * person's), with its start marker and nickname; null when the person has none.
 */
export function currentAccountOf(person: string): { account: string | null; nickname: string } | null {
  return !isWithdrawn() && mockCredentials.personKey !== "" && mockCredentials.personKey === person ? { account: accountSince(), nickname: mockAccount.nickname } : null;
}

/** A person's latest withdrawn account, while its 본인 확인 값 is kept (how the console names a 지급 불가 person). */
export function lastAccountOf(person: string): { account: string | null; nickname: string } | null {
  const a = withdrawnAccounts()
    .filter((w) => w.record.person?.key === person)
    .at(-1);
  return a ? { account: a.account, nickname: a.record.nickname } : null;
}

/** "홍길동" → "홍*동", "길동" → "길*", "별빛시청자" → "별***자": how winners are announced on the site. */
export function maskNickname(name: string): string {
  const chars = [...name.trim()];
  if (chars.length <= 1) return "*";
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${"*".repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

const fn = (n: number) => n.toLocaleString("ko-KR");
/** "참여자 전원 무상 FN · 1인 1,000 FN" / "추첨 3명 경품 · 문화상품권" (audit log). */
export const rewardText = (r: EventReward) => (r.kind === "FREE_FN" ? `참여자 전원 무상 FN · 1인 ${fn(r.amountFn)} FN` : `추첨 ${fn(r.winners)}명 경품 · ${r.prize}`);

const isWhole = (v: unknown, max: number): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 1 && v <= max;

/** The reward an operator sent, or the message the console shows. Bounds are sanity limits, not business rules. */
export function readRewardInput(v: Record<string, unknown>): EventReward | { message: string } {
  if (v.kind === "FREE_FN") {
    if (!isWhole(v.amountFn, EVENT_REWARD_LIMITS.amountMaxFn)) return { message: `지급 FN을 1~${fn(EVENT_REWARD_LIMITS.amountMaxFn)} 사이의 정수로 입력해 주세요.` };
    return { kind: "FREE_FN", amountFn: v.amountFn };
  }
  if (v.kind === "DRAW") {
    if (!isWhole(v.winners, EVENT_REWARD_LIMITS.winnersMax)) return { message: `당첨 인원을 1~${fn(EVENT_REWARD_LIMITS.winnersMax)}명으로 입력해 주세요.` };
    const prize = typeof v.prize === "string" ? v.prize.trim() : "";
    if (prize.length < EVENT_REWARD_LIMITS.prizeMin || prize.length > EVENT_REWARD_LIMITS.prizeMax) return { message: `경품 내용을 ${EVENT_REWARD_LIMITS.prizeMin}~${EVENT_REWARD_LIMITS.prizeMax}자로 입력해 주세요.` };
    if (MOCK_FORBIDDEN_WORDS.some((w) => prize.toLowerCase().includes(w))) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
    return { kind: "DRAW", winners: v.winners, prize };
  }
  return { message: "보상 종류를 골라 주세요." };
}

/** What the site shows once results are out: 보상 지급 or 당첨자 발표 (masked nicknames only). */
export function siteOutcomeOf(eventId: string): EventOutcome | null {
  const r = resultOf(eventId);
  if (!r) return null;
  return r.kind === "FREE_FN" ? { kind: "FREE_FN", at: r.at } : { kind: "DRAW", at: r.at, winners: r.winners.map((w) => w.masked) };
}

/**
 * The viewer's own result: 보상 n FN을 받았어요 only on the account that was credited (a 재가입 account did not get it);
 * 당첨됐어요 / 아쉽지만 당첨되지 않았어요 for the person who joined.
 */
export function myResultOf(eventId: string, person: string | null, joined: boolean): MyEventResult | null {
  const r = resultOf(eventId);
  if (!r || !person || !joined) return null;
  if (r.kind === "DRAW") return r.winners.some((w) => w.person === person) ? { kind: "WON" } : { kind: "NOT_WON" };
  const paid = !isWithdrawn() ? r.paid.find((p) => p.person === person && p.account === accountSince()) : undefined;
  return paid ? { kind: "PAID", amountFn: paid.amountFn } : null;
}
