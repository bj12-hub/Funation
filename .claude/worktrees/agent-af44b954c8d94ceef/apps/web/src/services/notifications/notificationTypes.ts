/**
 * 사이트 알림 — code-first (funnation header 알림). Client-safe types.
 * Which events notify, retention, and push / e-mail delivery are TBD.
 */

export type NotificationKind = "DONATION_SENT" | "DONATION_RECEIVED" | "CHARGE" | "REFUND" | "NOTICE" | "SYSTEM";

export const NOTIFICATION_KIND_LABEL: Record<NotificationKind, { emoji: string; label: string }> = {
  DONATION_SENT: { emoji: "💝", label: "후원" },
  DONATION_RECEIVED: { emoji: "💰", label: "받은 후원" },
  CHARGE: { emoji: "💳", label: "충전" },
  REFUND: { emoji: "↩️", label: "환불" },
  NOTICE: { emoji: "📢", label: "공지" },
  SYSTEM: { emoji: "✨", label: "안내" }
};

export type SiteNotification = { id: string; kind: NotificationKind; title: string; body: string; href: string; createdAt: string; read: boolean };

export type NotificationFilter = "ALL" | "UNREAD";

export type NotificationPage = { items: SiteNotification[]; unread: number; total: number; hasMore: boolean };

export const NOTIFICATIONS_KEEP = 100;
export const NOTIFICATIONS_PAGE = 20;

/** "방금" · "N분 전" · "N시간 전" · "N일 전". */
export const timeAgo = (iso: string, now = Date.now()) => {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  if (min < 1440) return `${Math.floor(min / 60)}시간 전`;
  return `${Math.floor(min / 1440)}일 전`;
};
