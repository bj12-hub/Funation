"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { getCreatorById, getCreators } from "@/services/creators/creators";
import { MAILBOXES, MESSAGE_BODY_MAX, MESSAGE_PAGE_SIZE, SEND_LIMIT_PER_HOUR, isMailbox, type Mailbox, type MailboxView, type MessageResult, type Recipient } from "./messageTypes";
import { mockMessages, type MockMessage } from "./mockMessageStore";

/**
 * 쪽지 Server Actions — code-first (no Figma frame). Route `/messages`. Every action re-checks the
 * session; message ids are only looked up inside the member's own mailbox. TBD: moderation of
 * reported mail, blocking, attachments, retention, notifications.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Messages API is not connected yet.");
};

const inBox = (m: MockMessage, box: Mailbox) => !m.deleted && m.folder === box;

export async function getMailbox(params: { box?: unknown; q?: unknown; page?: unknown }): Promise<MailboxView | null> {
  assertMock();
  if (!(await getSession())) return null;
  const box: Mailbox = isMailbox(params.box) ? params.box : "inbox";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 40) : "";
  await mockDelay(200);
  const needle = q.toLowerCase();
  const all = mockMessages.messages
    .filter((m) => inBox(m, box) && (!needle || m.body.toLowerCase().includes(needle) || m.peerName.toLowerCase().includes(needle)))
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  const totalPages = Math.max(1, Math.ceil(all.length / MESSAGE_PAGE_SIZE));
  const n = Number(params.page);
  const page = Number.isInteger(n) && n >= 1 && n <= totalPages ? n : 1;
  const counts = Object.fromEntries(MAILBOXES.map((b) => [b.key, mockMessages.messages.filter((m) => inBox(m, b.key)).length])) as Record<Mailbox, number>;
  return {
    box,
    q,
    items: all.slice((page - 1) * MESSAGE_PAGE_SIZE, page * MESSAGE_PAGE_SIZE).map(({ id, peerId, peerName, body, sentAt, read, direction }) => ({ id, peerId, peerName, body, sentAt, read, direction })),
    page,
    totalPages,
    counts,
    unread: mockMessages.messages.filter((m) => inBox(m, "inbox") && !m.read).length
  };
}

/** Creators a member can write to (mock: the public creator directory). */
export async function getMessageRecipients(): Promise<Recipient[] | null> {
  assertMock();
  if (!(await getSession())) return null;
  const first = await getCreators({ page: 1 });
  const rest = await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, i) => getCreators({ page: i + 2 })));
  const all = [first, ...rest].flatMap((p) => p.items);
  return [...new Map(all.map((c) => [c.id, { id: c.id, name: c.name }])).values()];
}

export async function sendMessage(input: unknown): Promise<MessageResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as { to?: unknown; body?: unknown };
  const body = typeof v.body === "string" ? v.body.trim() : "";
  if (!body || body.length > MESSAGE_BODY_MAX) return { status: "INVALID", message: `내용을 1~${MESSAGE_BODY_MAX}자로 입력해 주세요.` };
  if (MOCK_FORBIDDEN_WORDS.some((w) => body.toLowerCase().includes(w))) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  const creator = typeof v.to === "string" ? await getCreatorById(v.to) : null;
  if (!creator) return { status: "INVALID", message: "받는 사람을 선택해 주세요." };
  const hourAgo = Date.now() - 3_600_000;
  mockMessages.sentLog = mockMessages.sentLog.filter((t) => new Date(t).getTime() > hourAgo);
  if (mockMessages.sentLog.length >= SEND_LIMIT_PER_HOUR) return { status: "LIMITED" };
  const now = new Date().toISOString();
  mockMessages.sentLog.push(now);
  await mockDelay(300);
  mockMessages.messages.push({
    id: `ms-${Date.now().toString(36)}-${mockMessages.messages.length}`,
    direction: "OUT",
    peerId: creator.id,
    peerName: creator.name,
    body,
    sentAt: now,
    read: true,
    folder: "sent",
    deleted: false
  });
  return { status: "SAVED" };
}

function own(id: unknown) {
  return typeof id === "string" ? mockMessages.messages.find((m) => m.id === id && !m.deleted) : undefined;
}

export async function markMessageRead(id: unknown): Promise<MessageResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  const m = own(id);
  if (m) m.read = true;
  return { status: "SAVED" };
}

/** Moves received mail between inbox / archive / spam. Sent mail cannot be moved. */
export async function moveMessages(input: unknown): Promise<MessageResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as { ids?: unknown; to?: unknown };
  if (v.to !== "inbox" && v.to !== "archive" && v.to !== "spam") return { status: "INVALID", message: "이동할 곳을 확인해 주세요." };
  if (!Array.isArray(v.ids) || v.ids.length === 0 || v.ids.length > 50) return { status: "INVALID", message: "쪽지를 선택해 주세요." };
  await mockDelay(200);
  for (const id of v.ids) {
    const m = own(id);
    // TODO: a spam report goes to moderation on the backend.
    if (m && m.direction === "IN") m.folder = v.to;
  }
  return { status: "SAVED" };
}

/** Soft delete; deleting twice is a no-op. */
export async function deleteMessages(ids: unknown): Promise<MessageResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) return { status: "INVALID", message: "쪽지를 선택해 주세요." };
  await mockDelay(200);
  for (const id of ids) {
    const m = own(id);
    if (m) m.deleted = true;
  }
  return { status: "SAVED" };
}
