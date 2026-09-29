"use server";

import { USE_MOCK } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { notificationStore } from "./notificationCore";
import { NOTIFICATIONS_PAGE, type NotificationPage } from "./notificationTypes";

/** 사이트 알림 Server Actions — code-first. Header bell + route `/notifications`. Signed-in members only. */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Notification API is not connected yet.");
};

export async function getUnreadCount(): Promise<number | null> {
  assertMock();
  if (!(await getSession())) return null;
  return notificationStore().items.filter((n) => !n.read).length;
}

export async function listNotifications(input: { filter?: unknown; show?: unknown } = {}): Promise<NotificationPage | null> {
  assertMock();
  if (!(await getSession())) return null;
  const all = notificationStore().items;
  const list = input.filter === "UNREAD" ? all.filter((n) => !n.read) : all;
  const count = Math.min(Math.max(1, Math.floor(Number(input.show)) || NOTIFICATIONS_PAGE), 100);
  return { items: list.slice(0, count).map((n) => ({ ...n })), unread: all.filter((n) => !n.read).length, total: list.length, hasMore: list.length > count };
}

/** Idempotent. An unknown id is ignored (it may have aged out of the inbox). */
export async function markNotificationRead(id: unknown): Promise<{ status: "OK" | "UNAUTHORIZED" }> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  const n = notificationStore().items.find((x) => x.id === id);
  if (n) n.read = true;
  return { status: "OK" };
}

export async function markAllNotificationsRead(): Promise<{ status: "OK" | "UNAUTHORIZED" }> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  for (const n of notificationStore().items) n.read = true;
  return { status: "OK" };
}
