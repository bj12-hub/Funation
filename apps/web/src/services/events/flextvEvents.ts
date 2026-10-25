import { fetchEventPage, fetchEvents, type FlextvEvent, type FlextvEventPage } from "@/lib/flextv/events";
import { FLEXTV_WEB_URL } from "@/lib/flextv/mode";

/**
 * 이벤트 with FLEXTV (phase 9, docs/development/flextv-backend.md "9단계"): FLEXTV's 진행 중 and 종료 events, read here
 * and joined on FLEXTV's site (its events are its own pages and flows). Routes `/events`, `/events/[id]` (FLEXTV's event
 * number). Server-only reads.
 */

export const FLEXTV_EVENTS_PAGE = 12;

export type FlextvEventListView = { ended: boolean; items: FlextvEvent[]; total: number; show: number; hasMore: boolean };

/** `filter` "ended" shows FLEXTV's 종료 events; anything else its 진행 중 ones. */
export async function getFlextvEvents(filter: unknown, show: unknown): Promise<FlextvEventListView> {
  const ended = filter === "ended";
  const count = Math.min(Math.max(FLEXTV_EVENTS_PAGE, Math.floor(Number(show)) || FLEXTV_EVENTS_PAGE), 96);
  const { items, total } = await fetchEvents({ ended, offset: 0, limit: count });
  return { ended, items, total, show: count, hasMore: items.length >= count && total > items.length };
}

export type FlextvEventDetail = FlextvEventPage & { flextvUrl: string };

/** FLEXTV's page of the event (where it is joined): its 진행 중 or 종료 board, by its code when it has one. */
export const flextvEventUrl = (e: Pick<FlextvEventPage, "id" | "code" | "ongoing">) => `${FLEXTV_WEB_URL}/events/${e.ongoing ? "proceeding" : "terminated"}/${encodeURIComponent(e.code ?? e.id)}`;

export async function getFlextvEvent(id: unknown): Promise<FlextvEventDetail | null> {
  if (typeof id !== "string") return null;
  const page = await fetchEventPage(id);
  return page ? { ...page, flextvUrl: flextvEventUrl(page) } : null;
}
