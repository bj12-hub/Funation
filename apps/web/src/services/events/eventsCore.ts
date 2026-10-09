import { kstDateString } from "@/lib/period";
import { currentPersonKey } from "@/services/account/mockStore";
import type { EventPhase } from "./eventTypes";

/**
 * 이벤트 — server-only catalog and participation (not a "use server" module, no Node built-ins): the site's event
 * actions (./events.ts) and the console's 운영 › 이벤트 (admin/events.ts) read the same records.
 * 2026-10-08 결정: one join per event per person, keyed by the phone verified at sign-up (like 출석).
 */

export type MockEvent = { id: string; title: string; summary: string; body: string; emoji: string; startOffsetDays: number; lengthDays: number; baseParticipants: number };

/**
 * Sample events, dated relative to today (placeholder copy). `baseParticipants`: a sample count shown on the site on top
 * of the recorded joins — not people, so never paid or drawn.
 */
export const EVENTS: MockEvent[] = [
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

export const findEvent = (id: unknown) => EVENTS.find((x) => x.id === id) ?? null;

const DAY = 86_400_000;
/** Whole Korean days (00:00 KST to the end of the last day), the days eventPeriodLabel shows, whatever the server's zone. */
export function eventDates(e: MockEvent) {
  const start = new Date(`${kstDateString(new Date(Date.now() + e.startOffsetDays * DAY))}T00:00:00+09:00`);
  const end = new Date(start.getTime() + e.lengthDays * DAY - 1);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}
export function eventPhase(e: MockEvent): EventPhase {
  const { startsAt, endsAt } = eventDates(e);
  const now = new Date().toISOString();
  return now < startsAt ? "upcoming" : now > endsAt ? "ended" : "ongoing";
}

/**
 * `joined`: event id → person (`currentPersonKey`) → when they joined. V2: per person (V1 kept one join per event).
 * The ended sample event has a join by the person holding the account slot when the store is first read (the sample
 * member), so its reward and result can be tried in the mock.
 */
type Store = { joined: Map<string, Map<string, string>> };
const g = globalThis as typeof globalThis & { __ssumnationMockEventsV2?: Store };
export const eventStore = (): Store =>
  (g.__ssumnationMockEventsV2 ??= (() => {
    const ended = EVENTS.find((e) => e.id === "ev-attendance")!;
    const joinedAt = new Date(Date.parse(eventDates(ended).startsAt) + 2 * DAY).toISOString();
    const person = currentPersonKey(); // "" while the sample account is withdrawn: no sample join then
    return { joined: new Map(person ? [[ended.id, new Map([[person, joinedAt]])]] : []) };
  })());

/** The people who joined an event (person key → when), in join order. */
export const participantsOf = (eventId: string): Map<string, string> => eventStore().joined.get(eventId) ?? new Map();
