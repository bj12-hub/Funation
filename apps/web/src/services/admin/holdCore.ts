import { HOLD_NOTE, type AdminActor, type AdminHold, type HoldAction } from "./adminTypes";

/**
 * 보류 / 보류 해제 (2026-10-08 결정) — server-only helpers shared by 정산 심사 (settlements.ts) and 충전 환불 (payments.ts);
 * not a "use server" module and no Node built-ins, like the other admin cores.
 *
 * A hold is an operator flag kept as a list of events on the request itself: the last event says whether it is on. The
 * request's own state (심사 대기 · 승인) never changes, so 보류 해제 puts it back exactly as it was. Each event carries the
 * console request id that made it: the same id again answers OK without a second event or audit entry.
 */

/** One 보류 or 보류 해제, with the operator's memo and the console request id (that id stays on the server). */
export type HoldEvent = { action: HoldAction; at: string; by: string; note: string; requestId: string };
type Holdable = { holds?: HoldEvent[] };

const REQUEST_ID = /^[A-Za-z0-9-]{16,64}$/;

/** The hold in force (the last event is a 보류), without the request id; null when there is none. */
export function activeHold(holds: HoldEvent[] | undefined): AdminHold | null {
  const last = holds && holds.length > 0 ? holds[holds.length - 1] : undefined;
  return last?.action === "HOLD" ? { at: last.at, by: last.by, note: last.note } : null;
}

/** The console request id of a hold call, or null when it is missing or malformed. */
export const holdRequestId = (v: Record<string, unknown>) => (typeof v.requestId === "string" && REQUEST_ID.test(v.requestId) ? v.requestId : null);

/** The request that already recorded this console request id, and what it recorded (a retry). */
export function recordedHold<T extends Holdable>(items: T[], requestId: string): { item: T; event: HoldEvent } | null {
  for (const item of items) {
    const event = item.holds?.find((e) => e.requestId === requestId);
    if (event) return { item, event };
  }
  return null;
}

/**
 * Whether a call that reuses a recorded console request id asks for what that id recorded: the same action and memo (as
 * stored, trimmed). The caller also checks that it is for the same request. A different payload under the same id is
 * refused, never answered OK for something that was not done.
 */
export const sameHoldCall = (event: HoldEvent, v: Record<string, unknown>) => event.action === v.action && event.note === (typeof v.note === "string" ? v.note.trim() : "");

/** The action and memo of a hold call, or the message the console shows. */
export function readHoldInput(v: Record<string, unknown>): { action: HoldAction; note: string } | { message: string } {
  if (v.action !== "HOLD" && v.action !== "RELEASE") return { message: "보류 또는 보류 해제를 골라 주세요." };
  const note = typeof v.note === "string" ? v.note.trim() : "";
  if (note.length < HOLD_NOTE.min || note.length > HOLD_NOTE.max) {
    return { message: `${v.action === "HOLD" ? "보류" : "보류 해제"} 메모를 ${HOLD_NOTE.min}~${HOLD_NOTE.max}자로 입력해 주세요.` };
  }
  return { action: v.action, note };
}

/** Records a 보류 / 보류 해제 on the request (the caller checked that it may, in the same synchronous step). */
export function pushHold(item: Holdable, admin: AdminActor, action: HoldAction, note: string, requestId: string, now = new Date()) {
  (item.holds ??= []).push({ action, at: now.toISOString(), by: admin.nickname, note, requestId });
}
