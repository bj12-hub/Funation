"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { currentPersonKey } from "@/services/account/mockStore";
import { myResultOf, plainReward, rewardOf, siteOutcomeOf } from "./eventRewardCore";
import { EVENTS, eventDates, eventPhase, eventStore, findEvent, type MockEvent } from "./eventsCore";
import { isEventFilter, type EventDetail, type EventListView, type EventSummary, type JoinResult } from "./eventTypes";

/**
 * 이벤트 Server Actions — code-first (no Figma frame). Routes `/events`, `/events/[id]`. Joining is
 * idempotent and only allowed while an event is running.
 * 2026-10-08 결정: one join per event per person, keyed by the phone verified at sign-up (like 출석): a 재가입 with
 * the same phone finds its join (참여함) and cannot join again; another person can. Responses carry only `joined`
 * and the count, never who joined. Rewards (2026-10-08 결정): the detail shows the reward an operator set, and after the
 * event the outcome (보상 지급 / 당첨자 발표, masked nicknames) and the viewer's own result (./eventRewardCore.ts).
 * TBD: eligibility, other abuse checks, 경품 고시 / 제세공과금, prize delivery.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Events API is not connected yet.");
};

/** `person`: the viewer (`currentPersonKey`), or null for a guest. */
function summary(e: MockEvent, person: string | null): EventSummary {
  const people = eventStore().joined.get(e.id);
  const joined = person !== null && !!people?.has(person);
  return { id: e.id, title: e.title, summary: e.summary, emoji: e.emoji, ...eventDates(e), phase: eventPhase(e), joined, participants: e.baseParticipants + (people?.size ?? 0) };
}

export async function getEvents(filter: unknown): Promise<EventListView> {
  assertMock();
  const session = await getSession();
  const f = isEventFilter(filter) ? filter : "all";
  await mockDelay(200);
  const person = session ? currentPersonKey() : null;
  const items = EVENTS.map((e) => summary(e, person))
    .filter((e) => (f === "all" ? true : f === "mine" ? e.joined : e.phase === f))
    .sort((a, b) => ["ongoing", "upcoming", "ended"].indexOf(a.phase) - ["ongoing", "upcoming", "ended"].indexOf(b.phase));
  return { filter: f, items, signedIn: !!session };
}

export async function getEvent(id: unknown): Promise<EventDetail | null> {
  assertMock();
  const session = await getSession();
  const e = findEvent(id);
  if (!e) return null;
  const person = session ? currentPersonKey() : null;
  const s = summary(e, person);
  const reward = rewardOf(e.id);
  return {
    ...s,
    body: e.body,
    rewardNote: "보상 내용과 지급 방식은 정책이 확정되면 안내돼요 (TBD).",
    reward: reward ? plainReward(reward) : null,
    outcome: siteOutcomeOf(e.id),
    myResult: myResultOf(e.id, person, s.joined)
  };
}

/** Records participation once per person; joining again (also from a 재가입 account of the same person) is a no-op. */
export async function joinEvent(id: unknown): Promise<JoinResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  const e = findEvent(id);
  if (!e) return { status: "NOT_FOUND" };
  if (eventPhase(e) !== "ongoing") return { status: "NOT_OPEN" };
  const person = currentPersonKey();
  const joined = eventStore().joined;
  const people = joined.get(e.id) ?? new Map<string, string>();
  if (!people.has(person)) {
    // Recorded before the delay, so a concurrent click finds it.
    people.set(person, new Date().toISOString());
    joined.set(e.id, people);
    await mockDelay(300);
  }
  // TODO: the backend records participation with a unique (event, person) key, and which account joined, for audit.
  // Rewards are paid per person to the account that belongs to them at payout (./eventRewardCore.ts).
  return { status: "JOINED" };
}
