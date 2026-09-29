/**
 * 쪽지 (direct messages) — code-first, no Figma frame (docs/figma/code-first-screens.md).
 * Reference: docs/research/funnation-reference.md §1. Moderation, retention, blocking between
 * members and the send limit are TBD; the limit below is a placeholder anti-spam guard.
 */

export const MESSAGE_BODY_MAX = 500;
export const MESSAGE_PAGE_SIZE = 15;
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
  counts: Record<Mailbox, number>;
  unread: number;
};

export type Recipient = { id: string; name: string };

export type MessageResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "LIMITED" } | { status: "UNAUTHORIZED" };
