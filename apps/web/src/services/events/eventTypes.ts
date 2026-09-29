/**
 * 이벤트 — code-first, no Figma frame (docs/figma/code-first-screens.md). Reference:
 * docs/research/funnation-reference.md §1. Participation is recorded only; rewards, winner
 * selection, eligibility and legal notices (경품 고시) are TBD, so no FN is credited here.
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

export type EventPhase = "ongoing" | "upcoming" | "ended";
export const PHASE_LABEL: Record<EventPhase, string> = { ongoing: "진행 중", upcoming: "예정", ended: "종료" };

export type EventSummary = { id: string; title: string; summary: string; startsAt: string; endsAt: string; phase: EventPhase; joined: boolean; participants: number; emoji: string };
export type EventDetail = EventSummary & { body: string; rewardNote: string };
export type EventListView = { filter: EventFilter; items: EventSummary[]; signedIn: boolean };
export type JoinResult = { status: "JOINED" } | { status: "NOT_OPEN" | "NOT_FOUND" | "UNAUTHORIZED" };
