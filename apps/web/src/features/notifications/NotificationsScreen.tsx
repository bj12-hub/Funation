"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { markAllNotificationsRead, markNotificationRead } from "@/services/notifications/notifications";
import { NOTIFICATION_KIND_LABEL, NOTIFICATIONS_PAGE, type NotificationFilter, type NotificationKind, type NotificationPage } from "@/services/notifications/notificationTypes";
import styles from "./notifications.module.css";

/** Kind names in the viewer's language (2026-11-01; the emoji stay in NOTIFICATION_KIND_LABEL). */
const KIND_KEY: Record<NotificationKind, MessageKey> = {
  DONATION_SENT: "notifications.kindDonationSent",
  DONATION_RECEIVED: "notifications.kindDonationReceived",
  CHARGE: "notifications.kindCharge",
  REFUND: "notifications.kindRefund",
  SETTLEMENT: "notifications.kindSettlement",
  EVENT: "notifications.kindEvent",
  NOTICE: "notifications.kindNotice",
  SYSTEM: "notifications.kindSystem"
};

/** "3분 전" · "3m ago" — the same steps as timeAgo in notificationTypes. */
function ago(iso: string, now: number, t: (key: MessageKey, vars?: Record<string, string | number>) => string) {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return t("notifications.justNow");
  if (min < 60) return t("notifications.minutesAgo", { n: min });
  if (min < 1440) return t("notifications.hoursAgo", { n: Math.floor(min / 60) });
  return t("notifications.daysAgo", { n: Math.floor(min / 1440) });
}

/** 알림 — code-first (no Figma frame). Route `/notifications` (`?filter=UNREAD`, `?show=`). */
export function NotificationsScreen({ page, filter, show }: { page: NotificationPage; filter: NotificationFilter; show: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  const act = (fn: () => Promise<unknown>, go?: string) =>
    startTransition(async () => {
      await fn().catch(() => undefined);
      if (go) router.push(go);
      else router.refresh();
    });
  const href = (f: NotificationFilter, s?: number) => `/notifications${f === "UNREAD" ? "?filter=UNREAD" : ""}${s ? `${f === "UNREAD" ? "&" : "?"}show=${s}` : ""}`;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{t("notifications.title")}</h1>
        <button type="button" className={styles.link} disabled={pending || page.unread === 0} onClick={() => act(markAllNotificationsRead)}>
          {t("notifications.markAll")}
        </button>
      </header>
      <nav className={styles.tabs} aria-label={t("notifications.filter")}>
        <Link href={href("ALL")} className={styles.tab} aria-current={filter === "ALL" ? "page" : undefined}>
          {t("notifications.all")}
        </Link>
        <Link href={href("UNREAD")} className={styles.tab} aria-current={filter === "UNREAD" ? "page" : undefined}>
          {t("notifications.unreadCount", { count: page.unread })}
        </Link>
      </nav>

      {page.items.length === 0 ? (
        <p className={styles.empty}>{filter === "UNREAD" ? t("notifications.emptyUnread") : t("notifications.empty")}</p>
      ) : (
        <ul className={styles.list}>
          {page.items.map((n) => (
            <li key={n.id}>
              <button type="button" className={styles.item} data-unread={n.read ? undefined : ""} disabled={pending} onClick={() => act(() => (n.read ? Promise.resolve() : markNotificationRead(n.id)), n.href)}>
                <span className={styles.emoji} aria-hidden="true">
                  {NOTIFICATION_KIND_LABEL[n.kind].emoji}
                </span>
                <span className={styles.text}>
                  <span className={styles.meta}>
                    {t(KIND_KEY[n.kind])}
                    {now !== null && ` · ${ago(n.createdAt, now, t)}`}
                    {!n.read && <span className={styles.dot} aria-label={t("notifications.unread")} />}
                  </span>
                  <strong>{n.title}</strong>
                  <span>{n.body}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {page.hasMore && (
        <Link href={href(filter, show + NOTIFICATIONS_PAGE)} className={styles.more} scroll={false}>
          {t("notifications.more", { shown: page.items.length, total: page.total })}
        </Link>
      )}
      <p className={styles.note}>{t("notifications.note")}</p>
    </div>
  );
}
