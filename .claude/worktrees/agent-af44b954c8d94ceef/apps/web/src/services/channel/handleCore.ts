import { mockCreator } from "@/services/creator/mockCreatorStore";
import { isValidChannelHandle } from "./channelTypes";

/**
 * Channel address (채널 주소 = 후원 페이지 주소, `mockCreator.handle`) registry — server-only, not a "use server" module.
 * 채널 만들기 and 후원 페이지 링크 설정 use the same rule (2026-10-08 결정), the same reserved list and the same taken set,
 * and both check it in the same tick as the write.
 */

/** Never a channel address: brand names and the site's own route segments. */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  "somnation",
  "funation",
  "admin",
  "api",
  "attendance",
  "channel",
  "community",
  "creator",
  "creators",
  "donate",
  "donation",
  "events",
  "favorites",
  "hall-of-fame",
  "live",
  "login",
  "messages",
  "mypage",
  "notifications",
  "overlay",
  "password-reset",
  "popout",
  "signup",
  "support",
  "terms",
  "wallet",
  "widget"
]);

/** Addresses of other channels in the mock (the backend checks its channel table). */
const OTHER_CHANNEL_HANDLES: ReadonlySet<string> = new Set(["taen", "boharium", "seran"]);

/**
 * 예전 채널 주소는 새 주소로 연결 (2026-10-08 결정): after a change the old address points to the new one for this many
 * days and nobody else can take it. 30일 is the decided example value and may change.
 */
export const OLD_HANDLE_REDIRECT_DAYS = 30;

type HeldHandle = { handle: string; until: string };
const g = globalThis as typeof globalThis & { __funationMockHandlesV1?: { held: HeldHandle[] } };
const store = () => (g.__funationMockHandlesV1 ??= { held: [] });
const heldAt = (now: number) => store().held.filter((h) => Date.parse(h.until) > now);

export type HandleStatus = "INVALID" | "SAME" | "TAKEN" | "AVAILABLE";

/**
 * `owner`: the studio channel changing its own address — its current address is SAME and its own old addresses are
 * free to take back. Otherwise (a new channel) those are TAKEN too.
 */
export function handleStatus(handle: unknown, owner: boolean, now = Date.now()): HandleStatus {
  if (typeof handle !== "string" || !isValidChannelHandle(handle)) return "INVALID";
  if (owner && handle === mockCreator.handle) return "SAME";
  if (RESERVED_HANDLES.has(handle) || OTHER_CHANNEL_HANDLES.has(handle)) return "TAKEN";
  if (!owner && (handle === mockCreator.handle || heldAt(now).some((h) => h.handle === handle))) return "TAKEN";
  return "AVAILABLE";
}

/** Moves the studio channel to `next` (checked by the caller in the same tick); the old address keeps pointing to it. */
export function moveHandle(next: string, now = Date.now()) {
  const prev = mockCreator.handle;
  const until = new Date(now + OLD_HANDLE_REDIRECT_DAYS * 86_400_000).toISOString();
  store().held = [...heldAt(now).filter((h) => h.handle !== next && h.handle !== prev), { handle: prev, until }];
  mockCreator.handle = next;
}

/** Mock: a newly created channel replaces the studio channel, so the replaced channel's old addresses go with it. */
export function startHandle(handle: string) {
  store().held = [];
  mockCreator.handle = handle;
}

/** The current address an old one points to while it is held, or null (also for the current address itself). */
export function movedHandle(handle: string, now = Date.now()): string | null {
  return handle !== mockCreator.handle && heldAt(now).some((h) => h.handle === handle) ? mockCreator.handle : null;
}
