/**
 * 쪽지 (direct messages) — code-first, no Figma frame (docs/figma/code-first-screens.md).
 * Reference: docs/research/funnation-reference.md §1. Moderation, retention, blocking between
 * members and the send limit are TBD; the limit below is a placeholder anti-spam guard.
 */

export const MESSAGE_BODY_MAX = 500;
/** 한 페이지에 볼 쪽지 수 (`?size=`, funnation 참고 — 2026-10-06 결정). */
export const MESSAGE_PAGE_SIZES = [15, 30, 50] as const;
export type MessagePageSize = (typeof MESSAGE_PAGE_SIZES)[number];
export const MESSAGE_PAGE_SIZE: MessagePageSize = 15;
export const parseMessagePageSize = (v: unknown): MessagePageSize =>
  MESSAGE_PAGE_SIZES.find((n) => String(n) === String(v)) ?? MESSAGE_PAGE_SIZE;
/** Placeholder anti-spam guard (TBD): messages a member may send per hour. */
export const SEND_LIMIT_PER_HOUR = 20;

export const MAILBOXES = [
  { key: "inbox", label: "받은 쪽지함" },
  { key: "sent", label: "보낸 쪽지" },
  { key: "archive", label: "보관함" },
  { key: "spam", label: "스팸함" }
] as const;
export type Mailbox = (typeof MAILBOXES)[number]["key"];
export const isMailbox = (v: unknown): v is Mailbox => MAILBOXES.some((m) => m.key === v);

/** What an empty list says: a search that found nothing is not an empty mailbox. */
export const mailboxEmptyText = (box: Mailbox, q: string) => {
  if (q) return "검색 결과가 없어요.";
  const label = MAILBOXES.find((b) => b.key === box)!.label;
  // 이/가 by the last syllable: "보관함이", "보낸 쪽지가".
  const last = label.charCodeAt(label.length - 1) - 0xac00;
  return `${label}${last >= 0 && last <= 11171 && last % 28 !== 0 ? "이" : "가"} 비어 있어요.`;
};

export type MessageItem = {
  id: string;
  /** The other party (sender for received mail, recipient for sent mail). */
  peerId: string;
  peerName: string;
  body: string;
  sentAt: string;
  read: boolean;
  direction: "IN" | "OUT";
};

export type MailboxView = {
  box: Mailbox;
  q: string;
  items: MessageItem[];
  page: number;
  totalPages: number;
  size: MessagePageSize;
  /** Matching messages in this box (all pages). */
  total: number;
  counts: Record<Mailbox, number>;
  unread: number;
};

export type Recipient = { id: string; name: string };

export type MessageResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "LIMITED" } | { status: "UNAUTHORIZED" };
