"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { markAllNotificationsRead, markNotificationRead } from "@/services/notifications/notifications";
import { NOTIFICATION_KIND_LABEL, NOTIFICATIONS_PAGE, timeAgo as ago, type NotificationFilter, type NotificationPage } from "@/services/notifications/notificationTypes";
import styles from "./notifications.module.css";

/** 알림 — code-first (no Figma frame). Route `/notifications` (`?filter=UNREAD`, `?show=`). */
export function NotificationsScreen({ page, filter, show }: { page: NotificationPage; filter: NotificationFilter; show: number }) {
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
        <h1 className={styles.title}>알림</h1>
        <button type="button" className={styles.link} disabled={pending || page.unread === 0} onClick={() => act(markAllNotificationsRead)}>
          모두 읽음
        </button>
      </header>
      <nav className={styles.tabs} aria-label="알림 필터">
        <Link href={href("ALL")} className={styles.tab} aria-current={filter === "ALL" ? "page" : undefined}>
          전체
        </Link>
        <Link href={href("UNREAD")} className={styles.tab} aria-current={filter === "UNREAD" ? "page" : undefined}>
          안 읽음 {page.unread}
        </Link>
      </nav>

      {page.items.length === 0 ? (
        <p className={styles.empty}>{filter === "UNREAD" ? "안 읽은 알림이 없어요." : "알림이 없어요."}</p>
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
                    {NOTIFICATION_KIND_LABEL[n.kind].label}
                    {now !== null && ` · ${ago(n.createdAt, now)}`}
                    {!n.read && <span className={styles.dot} aria-label="안 읽음" />}
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
          더 보기 ({page.items.length}/{page.total})
        </Link>
      )}
      <p className={styles.note}>최근 100개까지 보관해요. 알림 종류 설정 · 푸시 알림은 준비 중이에요 (TBD).</p>
    </div>
  );
}
