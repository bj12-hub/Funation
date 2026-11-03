import { fetchMyAccount } from "@/lib/flextv/member";
import { FLEXTV_WEB_URL } from "@/lib/flextv/mode";
import { fetchNotifications, type FlextvNotification } from "@/lib/flextv/notifications";
import { getFlextvAccessToken } from "@/lib/session";
import type { NotificationKind, NotificationPage, SiteNotification } from "./notificationTypes";

/**
 * 알림 with FLEXTV (phase 7, docs/development/flextv-backend.md "7단계"): FLEXTV's latest ten. FLEXTV keeps one "new"
 * flag for all of them, cleared when they are read, and no time — so the bell shows that there is something new, and
 * a list once read counts as read. ./notifications.ts delegates here.
 */

const KIND: Record<string, NotificationKind> = { "즐겨찾기 호스트 방송 시작": "LIVE", "충전 완료": "CHARGE" };

/** FLEXTV's channel pages are the rooms here; its other pages stay on its site. */
export function notificationHref(n: FlextvNotification, kind: NotificationKind): string {
  const channel = n.redirect?.match(/^\/channels\/([1-9]\d{0,17})(?:\/|$)/);
  if (channel) return `/creators/${channel[1]}`;
  if (n.redirect) return `${FLEXTV_WEB_URL}${n.redirect}`;
  if (kind === "LIVE") return "/favorites";
  if (kind === "CHARGE") return "/wallet/charges";
  return "/notifications";
}

export function siteNotificationOf(n: FlextvNotification, index: number): SiteNotification {
  const kind = KIND[n.label] ?? "SYSTEM";
  return { id: `flextv-${index}`, kind, title: n.label || "알림", body: n.message, href: notificationHref(n, kind), createdAt: null, read: true };
}

/** 1 when FLEXTV has something new (the bell shows "N"), 0 otherwise; null signed out. */
export async function flextvUnreadCount(): Promise<number | null> {
  const token = await getFlextvAccessToken();
  const account = token ? await fetchMyAccount(token) : null;
  return account ? Number(account.newNotifications) : null;
}

export async function flextvNotificationPage(filter: unknown): Promise<NotificationPage | null> {
  const token = await getFlextvAccessToken();
  const list = token ? await fetchNotifications(token) : null;
  if (!list) return null;
  // Read now (FLEXTV marked them seen): nothing is left unread.
  const items = filter === "UNREAD" ? [] : list.map(siteNotificationOf);
  return { items, unread: 0, total: items.length, hasMore: false };
}
