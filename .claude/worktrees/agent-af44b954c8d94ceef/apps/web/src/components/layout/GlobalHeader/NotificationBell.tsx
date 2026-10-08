"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BellOutlineIcon } from "@/components/icons";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { getUnreadCount, listNotifications, markAllNotificationsRead, markNotificationRead } from "@/services/notifications/notifications";
import { NOTIFICATION_KIND_LABEL, timeAgo as ago, type SiteNotification } from "@/services/notifications/notificationTypes";
import styles from "./GlobalHeader.module.css";

const POLL_MS = 30_000;

/**
 * 알림 bell (code-first) — unread badge polled from the server every 30s while the tab is visible; the
 * popover loads the latest items when opened. Reading marks the item on the server.
 */
export function NotificationBell() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SiteNotification[] | null>(null);
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      setUnread((await getUnreadCount()) ?? 0);
    } catch {
      // Keep the last count; the next poll retries.
    }
  }, []);

  useEffect(() => {
    void refreshCount();
    const id = setInterval(() => document.visibilityState === "visible" && void refreshCount(), POLL_MS);
    return () => clearInterval(id);
  }, [refreshCount, pathname]);

  const load = async () => {
    setFailed(false);
    try {
      const page = await listNotifications({ show: 8 });
      setItems(page?.items ?? []);
      setUnread(page?.unread ?? 0);
    } catch {
      setFailed(true);
    }
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setItems(null);
      void load();
    }
  };
  const openItem = async (n: SiteNotification) => {
    setOpen(false);
    if (!n.read) {
      setUnread((c) => Math.max(0, c - 1));
      await markNotificationRead(n.id).catch(() => undefined);
    }
    router.push(n.href);
  };
  const readAll = async () => {
    await markAllNotificationsRead().catch(() => undefined);
    setItems((list) => list?.map((n) => ({ ...n, read: true })) ?? list);
    setUnread(0);
  };

  return (
    <div className={styles.bellRoot} ref={root}>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={unread ? `${t("common.notifications")} (${unread})` : t("common.notifications")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        <BellOutlineIcon />
        {unread > 0 && (
          <span className={styles.bellBadge} aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className={styles.bellPanel} role="dialog" aria-label={t("common.notifications")}>
          <div className={styles.bellHead}>
            <strong>{t("common.notifications")}</strong>
            <button type="button" className={styles.bellLink} disabled={!unread} onClick={readAll}>
              모두 읽음
            </button>
          </div>
          {failed ? (
            <p className={styles.bellEmpty} role="alert">
              알림을 불러오지 못했어요.{" "}
              <button type="button" className={styles.bellLink} onClick={load}>
                다시 시도
              </button>
            </p>
          ) : items === null ? (
            <p className={styles.bellEmpty} aria-busy="true">
              불러오는 중…
            </p>
          ) : items.length === 0 ? (
            <p className={styles.bellEmpty}>새 알림이 없어요.</p>
          ) : (
            <ul className={styles.bellList}>
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" className={styles.bellItem} data-unread={n.read ? undefined : ""} onClick={() => openItem(n)}>
                    <span aria-hidden="true">{NOTIFICATION_KIND_LABEL[n.kind].emoji}</span>
                    <span className={styles.bellText}>
                      <strong>{n.title}</strong>
                      <span>{n.body}</span>
                      <small>{ago(n.createdAt)}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link href="/notifications" className={styles.bellAll} onClick={() => setOpen(false)}>
            전체 알림 보기
          </Link>
        </div>
      )}
    </div>
  );
}
