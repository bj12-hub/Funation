"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { kstDateString } from "@/lib/period";
import { getSession } from "@/lib/session";
import { currentPersonKey } from "@/services/account/mockStore";
import { isEventFilter, type EventDetail, type EventListView, type EventPhase, type EventSummary, type JoinResult } from "./eventTypes";

/**
 * 이벤트 Server Actions — code-first (no Figma frame). Routes `/events`, `/events/[id]`. Joining is
 * idempotent and only allowed while an event is running.
 * 2026-10-08 결정: one join per event per person, keyed by the phone verified at sign-up (like 출석): a 재가입 with
 * the same phone finds its join (참여함) and cannot join again; another person can. Responses carry only `joined`
 * and the count, never who joined.
 * TBD: rewards, winners, eligibility, other abuse checks, 경품 고시 / 제세공과금.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Events API is not connected yet.");
};

type MockEvent = { id: string; title: string; summary: string; body: string; emoji: string; startOffsetDays: number; lengthDays: number; baseParticipants: number };

/** Sample events, dated relative to today (placeholder copy; reward rules are TBD). */
const EVENTS: MockEvent[] = [
  {
    id: "ev-first-donation",
    title: "첫 후원 응원 이벤트",
    summary: "좋아하는 크리에이터에게 첫 후원을 보내고 이벤트에 참여해 보세요.",
    body: "이벤트 기간 동안 참여 신청 후 크리에이터에게 후원하면 참여가 완료돼요.\n참여 대상, 보상 내용과 지급 방식은 확정되면 이 페이지에 안내할게요.",
    emoji: "🎁",
    startOffsetDays: -5,
    lengthDays: 20,
    baseParticipants: 312
  },
  {
    id: "ev-crew-season",
    title: "크루 방송 시즌 오픈",
    summary: "크루 방송에 참여한 시청자를 위한 시즌 이벤트예요.",
    body: "크루 방송 회차에 멤버를 지정해 후원하면 시즌 이벤트에 참여할 수 있어요.\n세부 규칙은 시즌 시작 전에 공개됩니다.",
    emoji: "🏆",
    startOffsetDays: 7,
    lengthDays: 30,
    baseParticipants: 0
  },
  {
    id: "ev-attendance",
    title: "출석체크 챌린지",
    summary: "한 달 동안 출석체크를 이어 가는 챌린지였어요.",
    body: "지난 출석체크 챌린지입니다. 참여해 주셔서 감사합니다.",
    emoji: "📅",
    startOffsetDays: -40,
    lengthDays: 30,
    baseParticipants: 1_024
  }
];

/** `joined`: event id → person (`currentPersonKey`) → when they joined. V2: per person (V1 kept one join per event). */
const g = globalThis as typeof globalThis & { __funationMockEventsV2?: { joined: Map<string, Map<string, string>> } };
const state = (g.__funationMockEventsV2 ??= { joined: new Map() });

const DAY = 86_400_000;
/** Whole Korean days (00:00 KST to the end of the last day), the days eventPeriodLabel shows, whatever the server's zone. */
function dates(e: MockEvent) {
  const start = new Date(`${kstDateString(new Date(Date.now() + e.startOffsetDays * DAY))}T00:00:00+09:00`);
  const end = new Date(start.getTime() + e.lengthDays * DAY - 1);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}
function phase(e: MockEvent): EventPhase {
  const { startsAt, endsAt } = dates(e);
  const now = new Date().toISOString();
  return now < startsAt ? "upcoming" : now > endsAt ? "ended" : "ongoing";
}
/** `person`: the viewer (`currentPersonKey`), or null for a guest. */
function summary(e: MockEvent, person: string | null): EventSummary {
  const people = state.joined.get(e.id);
  const joined = person !== null && !!people?.has(person);
  return { id: e.id, title: e.title, summary: e.summary, emoji: e.emoji, ...dates(e), phase: phase(e), joined, participants: e.baseParticipants + (people?.size ?? 0) };
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
  const e = EVENTS.find((x) => x.id === id);
  if (!e) return null;
  const s = summary(e, session ? currentPersonKey() : null);
  return { ...s, body: e.body, rewardNote: "보상 내용과 지급 방식은 정책이 확정되면 안내돼요 (TBD)." };
}

/** Records participation once per person; joining again (also from a 재가입 account of the same person) is a no-op. */
export async function joinEvent(id: unknown): Promise<JoinResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  const e = EVENTS.find((x) => x.id === id);
  if (!e) return { status: "NOT_FOUND" };
  if (phase(e) !== "ongoing") return { status: "NOT_OPEN" };
  const person = currentPersonKey();
  const people = state.joined.get(e.id) ?? new Map<string, string>();
  if (!people.has(person)) {
    // Recorded before the delay, so a concurrent click finds it.
    people.set(person, new Date().toISOString());
    state.joined.set(e.id, people);
    await mockDelay(300);
  }
  // TODO: the backend records participation with a unique (event, person) key, and which account joined, for audit
  // and later reward processing.
  return { status: "JOINED" };
}
