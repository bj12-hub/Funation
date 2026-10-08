import { randomUUID } from "node:crypto";
import { NOTIFICATIONS_KEEP, type NotificationKind, type SiteNotification } from "./notificationTypes";

/**
 * Server-only notification inbox (not a "use server" module). Services call `notify` after their own
 * state change succeeded; the mock has one member, so there is one inbox (TBD: per-user inboxes).
 * `dedupeKey` keeps a retried operation from notifying twice.
 */

type Store = { items: SiteNotification[]; keys: Record<string, true> };
const g = globalThis as typeof globalThis & { __ssumnationMockNotificationsV1?: Store };

export const notificationStore = (): Store =>
  (g.__ssumnationMockNotificationsV1 ??= {
    items: [
      {
        id: "nt-seed-notice",
        kind: "NOTICE",
        title: "새 공지사항",
        body: "서비스 이름이 썸네이션(Ssumnation)으로 바뀌었어요",
        href: "/support/notices/brand",
        createdAt: "2026-09-29T09:00:00.000Z",
        read: false
      },
      { id: "nt-seed-welcome", kind: "SYSTEM", title: "썸네이션에 오신 걸 환영해요", body: "좋아하는 크리에이터를 찾아 응원해 보세요.", href: "/creators", createdAt: "2026-09-28T09:00:00.000Z", read: true }
    ],
    keys: {}
  });

export function notify(input: { kind: NotificationKind; title: string; body: string; href: string; dedupeKey?: string }, now = Date.now()) {
  const s = notificationStore();
  if (input.dedupeKey) {
    if (s.keys[input.dedupeKey]) return null;
    s.keys[input.dedupeKey] = true;
  }
  // A random id: the inbox is capped, so its length stops telling two notifications of the same millisecond apart.
  const item: SiteNotification = { id: `nt-${randomUUID()}`, kind: input.kind, title: input.title, body: input.body, href: input.href, createdAt: new Date(now).toISOString(), read: false };
  s.items.unshift(item);
  s.items.length = Math.min(s.items.length, NOTIFICATIONS_KEEP);
  return item;
}
