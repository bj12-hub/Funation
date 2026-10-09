import type { EventPhase, EventReward } from "@/services/events/eventTypes";

/**
 * 운영 › 이벤트 (2026-10-08 결정) — client-safe types of the console screen `/events` (admin app): each event's reward
 * setting and, after the event, its result. Amounts and winners come from the server.
 */

/** A participant as the console names them: the original nickname, marked when that account has withdrawn. */
export type AdminEventPerson = { memberId: string | null; name: string; withdrawn: boolean };

export type AdminEventResult =
  | {
      kind: "FREE_FN";
      at: string;
      by: string;
      amountFn: number;
      totalFn: number;
      paid: AdminEventPerson[];
      /** 지급 불가: no account now (withdrawn, no new account). */
      unpaid: AdminEventPerson[];
    }
  | {
      kind: "DRAW";
      at: string;
      by: string;
      winnersWanted: number;
      prize: string;
      /** Participants with an account, the draw's pool. */
      pool: number;
      /** `masked`: how the site announces the winner. */
      winners: (AdminEventPerson & { masked: string })[];
      /** Left out of the draw: no account now (지급 불가). */
      unpaid: AdminEventPerson[];
    };

export type AdminEventRow = {
  id: string;
  title: string;
  emoji: string;
  startsAt: string;
  endsAt: string;
  phase: EventPhase;
  /** Recorded participants (people, 2026-10-08 rule). */
  participants: number;
  /** The mock's sample count the site adds to the participant number — not people, never paid or drawn. */
  sampleParticipants: number;
  reward: (EventReward & { updatedAt: string; updatedBy: string }) | null;
  result: AdminEventResult | null;
};

export type AdminEventsView = { events: AdminEventRow[] };

export type EventActionResult = { status: "OK" } | { status: "INVALID"; message: string } | { status: "NOT_FOUND" };
