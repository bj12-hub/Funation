import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NotificationsScreen } from "@/features/notifications/NotificationsScreen";
import { listNotifications } from "@/services/notifications/notifications";
import { NOTIFICATIONS_PAGE } from "@/services/notifications/notificationTypes";

// Code-first (no Figma frame): 사이트 알림 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "알림 | Ssumnation" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ filter?: string; show?: string }> }) {
  const { filter, show } = await searchParams;
  const f = filter === "UNREAD" ? "UNREAD" : "ALL";
  const s = Math.min(Math.max(NOTIFICATIONS_PAGE, Math.floor(Number(show)) || NOTIFICATIONS_PAGE), 100);
  const page = await listNotifications({ filter: f, show: s });
  if (!page) redirect("/login?next=/notifications");
  return <NotificationsScreen page={page} filter={f} show={s} />;
}
