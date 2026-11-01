import type { MessageKey } from "@/lib/i18n/translate";

/** "3분 전" · "3m ago" in the viewer's language — the same steps as timeAgo in notificationTypes (2026-11-01). */
export function agoText(iso: string, now: number, t: (key: MessageKey, vars?: Record<string, string | number>) => string) {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return t("notifications.justNow");
  if (min < 60) return t("notifications.minutesAgo", { n: min });
  if (min < 1440) return t("notifications.hoursAgo", { n: Math.floor(min / 60) });
  return t("notifications.daysAgo", { n: Math.floor(min / 1440) });
}
