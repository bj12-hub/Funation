import { USE_MOCK } from "@/lib/mock";
import { mockAccount } from "@/services/account/mockStore";
import { recordCredit } from "@/services/wallet/mockCreditStore";
import { drawWinners } from "@/services/events/eventDraw";
import {
  currentAccountOf,
  lastAccountOf,
  maskNickname,
  plainReward,
  readRewardInput,
  resultOf,
  rewardOf,
  rewardStore,
  rewardText,
  sameReward,
  type UnpaidEntry
} from "@/services/events/eventRewardCore";
import { EVENTS, eventDates, eventPhase, findEvent, participantsOf, type MockEvent } from "@/services/events/eventsCore";
import type { AdminActor } from "./adminTypes";
import { recordAudit } from "./auditCore";
import type { AdminEventPerson, AdminEventResult, AdminEventRow, AdminEventsView, EventActionResult } from "./eventAdminTypes";
import { slotAccountLabel } from "./memberCore";

/**
 * 운영 › 이벤트 API logic (2026-10-08 결정) — called by `/api/admin/events/*`; server-only (the draw uses node:crypto).
 *
 * - 보상 설정: one reward per event, 참여자 전원 무상 FN (an amount the operator enters — no default) or 추첨 N명 경품 (a
 *   winner count and prize text the operator enters). Saving the same reward again changes and logs nothing; it can no
 *   longer change once the result is out. Audited as `EVENT_REWARD_SET`.
 * - 보상 지급 (FREE_FN) / 당첨자 추첨 (DRAW): only after the event ended, once per event. A console request id makes a
 *   retry answer OK without a second payout or draw; any later call is refused. Audited as `EVENT_REWARD_PAY` /
 *   `EVENT_DRAW`. The checks and the writes run in one synchronous step (nothing awaits in between).
 * - Participants are people (person key); each is paid through the account that belongs to them now, once, as free FN
 *   with a wallet record (무상 FN, refund-excluded, like 출석 보상). Someone with no account now is skipped: 지급 불가
 *   (a draw leaves them out of the pool).
 * TBD: eligibility, 경품 고시 · 제세공과금, how a prize is delivered.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Admin event API is not connected yet.");
};
const REQUEST_ID = /^[A-Za-z0-9-]{16,64}$/;
const obj = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const fn = (n: number) => n.toLocaleString("ko-KR");

/** The console's name for an account by its start marker (withdrawn: original nickname + 탈퇴, `…-wN` after a 재가입). */
const personAt = (account: string | null): AdminEventPerson => {
  const a = slotAccountLabel(account);
  return { memberId: a.memberId, name: a.name, withdrawn: a.withdrawn };
};
const unpaidPerson = (u: UnpaidEntry): AdminEventPerson => (u.last ? personAt(u.last.account) : { memberId: null, name: "확인할 수 없는 참여자", withdrawn: true });
const unpaidOf = (person: string): UnpaidEntry => {
  const last = lastAccountOf(person);
  return { person, last: last ? { account: last.account } : null };
};

function resultRow(eventId: string): AdminEventResult | null {
  const r = resultOf(eventId);
  if (!r) return null;
  if (r.kind === "FREE_FN") {
    return { kind: "FREE_FN", at: r.at, by: r.by, amountFn: r.amountFn, totalFn: r.paid.reduce((s, p) => s + p.amountFn, 0), paid: r.paid.map((p) => personAt(p.account)), unpaid: r.unpaid.map(unpaidPerson) };
  }
  return { kind: "DRAW", at: r.at, by: r.by, winnersWanted: r.winnersWanted, prize: r.prize, pool: r.pool, winners: r.winners.map((w) => ({ ...personAt(w.account), masked: w.masked })), unpaid: r.unpaid.map(unpaidPerson) };
}

function eventRow(e: MockEvent): AdminEventRow {
  const reward = rewardOf(e.id);
  return {
    id: e.id,
    title: e.title,
    emoji: e.emoji,
    ...eventDates(e),
    phase: eventPhase(e),
    participants: participantsOf(e.id).size,
    sampleParticipants: e.baseParticipants,
    reward: reward ? { ...plainReward(reward), updatedAt: reward.updatedAt, updatedBy: reward.updatedBy } : null,
    result: resultRow(e.id)
  };
}

const PHASE_ORDER = ["ongoing", "upcoming", "ended"] as const;

export async function listEventsAdmin(): Promise<AdminEventsView> {
  assertMock();
  return { events: EVENTS.map(eventRow).sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase)) };
}

/** 보상 설정: `{ id, kind: "FREE_FN", amountFn }` or `{ id, kind: "DRAW", winners, prize }`. */
export async function saveEventReward(admin: AdminActor, input: unknown): Promise<EventActionResult> {
  assertMock();
  const v = obj(input);
  const e = findEvent(v.id);
  if (!e) return { status: "NOT_FOUND" };
  const read = readRewardInput(v);
  if ("message" in read) return { status: "INVALID", message: read.message };
  const done = resultOf(e.id);
  if (done) return { status: "INVALID", message: done.kind === "FREE_FN" ? "보상을 지급한 이벤트라 보상 설정을 바꿀 수 없어요." : "당첨자를 추첨한 이벤트라 보상 설정을 바꿀 수 없어요." };
  const current = rewardOf(e.id);
  // The same reward again (a retry after a lost response, a double click) changes nothing and logs nothing.
  if (current && sameReward(current, read)) return { status: "OK" };
  rewardStore().rewards[e.id] = { ...read, updatedAt: new Date().toISOString(), updatedBy: admin.nickname };
  recordAudit(admin, "EVENT_REWARD_SET", `event:${e.id}`, `${e.title} · ${rewardText(read)}${current ? ` (이전: ${rewardText(current)})` : ""}`);
  return { status: "OK" };
}

/**
 * The request id of a 지급 / 추첨 call that already ran: OK for the same event and kind (a retry), refused otherwise.
 * Null when the id was not used yet.
 */
function replayed(v: Record<string, unknown>, kind: "FREE_FN" | "DRAW"): EventActionResult | null {
  const hit = Object.entries(rewardStore().results).find(([, r]) => r.requestId === v.requestId);
  if (!hit) return null;
  return hit[0] === v.id && hit[1].kind === kind ? { status: "OK" } : { status: "INVALID", message: "잘못된 요청입니다." };
}

/** What stops 지급 / 추첨 for this event now, or null when it may run. */
function blocked(e: MockEvent, kind: "FREE_FN" | "DRAW"): string | null {
  const done = resultOf(e.id);
  if (done) return done.kind === "FREE_FN" ? "이미 보상을 지급한 이벤트예요." : "이미 당첨자를 추첨한 이벤트예요.";
  const reward = rewardOf(e.id);
  if (!reward) return "먼저 보상을 설정해 주세요.";
  if (reward.kind !== kind) return kind === "FREE_FN" ? "추첨 경품 이벤트예요. 당첨자 추첨으로 처리해 주세요." : "참여자 전원 무상 FN 이벤트예요. 보상 지급으로 처리해 주세요.";
  if (eventPhase(e) !== "ended") return kind === "FREE_FN" ? "이벤트가 끝난 뒤에 보상을 지급할 수 있어요." : "이벤트가 끝난 뒤에 당첨자를 추첨할 수 있어요.";
  return null;
}

/**
 * 보상 지급 (참여자 전원 무상 FN): `{ id, requestId }`. Credits each participant's current account once, as free FN with a
 * wallet record (FN Wallet 보상 · refund-excluded); people with no account now are listed as 지급 불가.
 */
export async function payEventReward(admin: AdminActor, input: unknown): Promise<EventActionResult> {
  assertMock();
  const v = obj(input);
  if (typeof v.requestId !== "string" || !REQUEST_ID.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const replay = replayed(v, "FREE_FN");
  if (replay) return replay;
  const e = findEvent(v.id);
  if (!e) return { status: "NOT_FOUND" };
  const stop = blocked(e, "FREE_FN");
  if (stop) return { status: "INVALID", message: stop };
  const reward = rewardOf(e.id);
  if (reward?.kind !== "FREE_FN") return { status: "INVALID", message: "먼저 보상을 설정해 주세요." };
  const paid: { person: string; account: string | null; amountFn: number }[] = [];
  const unpaid: UnpaidEntry[] = [];
  for (const person of participantsOf(e.id).keys()) {
    const now = currentAccountOf(person);
    if (!now) {
      unpaid.push(unpaidOf(person));
      continue;
    }
    // 무상 FN like 출석 보상: never refundable, spent before paid FN (환불 정책 기본값), with its wallet record.
    mockAccount.fnBalance += reward.amountFn;
    recordCredit(reward.amountFn, `이벤트 보상 · ${e.title}`);
    paid.push({ person, account: now.account, amountFn: reward.amountFn });
  }
  rewardStore().results[e.id] = { kind: "FREE_FN", at: new Date().toISOString(), by: admin.nickname, requestId: v.requestId, amountFn: reward.amountFn, paid, unpaid };
  recordAudit(
    admin,
    "EVENT_REWARD_PAY",
    `event:${e.id}`,
    `${e.title} · 1인 ${fn(reward.amountFn)} FN · 지급 ${fn(paid.length)}명 · 합계 ${fn(paid.length * reward.amountFn)} FN · 지급 불가 ${fn(unpaid.length)}명`
  );
  return { status: "OK" };
}

/**
 * 당첨자 추첨 (추첨 N명 경품): `{ id, requestId }`. Draws min(N, pool) winners fairly on the server (./eventDraw.ts) among
 * the participants who have an account now; the others are listed as 지급 불가. The site shows the winners masked.
 */
export async function drawEventWinners(admin: AdminActor, input: unknown): Promise<EventActionResult> {
  assertMock();
  const v = obj(input);
  if (typeof v.requestId !== "string" || !REQUEST_ID.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const replay = replayed(v, "DRAW");
  if (replay) return replay;
  const e = findEvent(v.id);
  if (!e) return { status: "NOT_FOUND" };
  const stop = blocked(e, "DRAW");
  if (stop) return { status: "INVALID", message: stop };
  const reward = rewardOf(e.id);
  if (reward?.kind !== "DRAW") return { status: "INVALID", message: "먼저 보상을 설정해 주세요." };
  const pool: { person: string; account: string | null; nickname: string }[] = [];
  const unpaid: UnpaidEntry[] = [];
  for (const person of participantsOf(e.id).keys()) {
    const now = currentAccountOf(person);
    if (now) pool.push({ person, ...now });
    else unpaid.push(unpaidOf(person));
  }
  const winners = drawWinners(pool, reward.winners).map((w) => ({ person: w.person, account: w.account, masked: maskNickname(w.nickname) }));
  rewardStore().results[e.id] = { kind: "DRAW", at: new Date().toISOString(), by: admin.nickname, requestId: v.requestId, winnersWanted: reward.winners, prize: reward.prize, pool: pool.length, winners, unpaid };
  recordAudit(admin, "EVENT_DRAW", `event:${e.id}`, `${e.title} · 경품 ${reward.prize} · 추첨 대상 ${fn(pool.length)}명 중 ${fn(winners.length)}명 당첨 · 지급 불가 ${fn(unpaid.length)}명`);
  return { status: "OK" };
}
