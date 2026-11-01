import { requestFrom } from "@/lib/flextv/auth";
import { fetchFavorites } from "@/lib/flextv/channels";
import { FlextvUnavailableError } from "@/lib/flextv/client";
import { fetchMyAccount } from "@/lib/flextv/member";
import { blockSender, deleteMessage, fetchBlocks, fetchMailbox, findReceiver, markRead, sendMessage, unblockSender, type FlextvMessage } from "@/lib/flextv/messages";
import { createQueue } from "@/lib/flextv/queue";
import { requestDeviceContext } from "@/lib/flextv/request";
import { getFlextvAccessToken } from "@/lib/session";
import type { BlockEntry, BlockResult } from "@/services/moderation/moderationTypes";
import { MESSAGE_BODY_MAX, parseMessagePageSize, type Mailbox, type MailboxView, type MessageItem, type MessageResult, type Recipient } from "./messageTypes";

/**
 * 쪽지 with FLEXTV (phase 9, docs/development/flextv-backend.md "9단계"): FLEXTV's 받은 쪽지 · 보낸 쪽지 and its 쪽지 차단.
 * A 쪽지 goes to a FLEXTV 아이디 (a streamer's: FLEXTV delivers only to members with a channel) and needs FLEXTV's
 * 본인인증; both are checked here first so the member is told why. FLEXTV has no 보관함, 스팸함 or search. Other members'
 * FLEXTV member ids stay on the server: a block is by the 쪽지 it came with, an unblock by the 아이디.
 * ./messages.ts and services/moderation/moderation.ts delegate here.
 */

const serialize = createQueue("messages");
const LOGIN_ID = /^[A-Za-z0-9_-]{1,40}$/;
const MESSAGE_ID = /^[1-9]\d{0,17}$/;
const BLOCKS_PAGE = 100;
/** One send per request id per member for 30 minutes (a retry after a lost answer sends nothing). */
const REQUEST_TTL_MS = 30 * 60 * 1000;
const g = globalThis as typeof globalThis & { __ssumnationFlextvMessageRequests?: Map<string, { at: number; result: Promise<MessageResult> }> };
const requests = (g.__ssumnationFlextvMessageRequests ??= new Map());

const itemOf = (m: FlextvMessage, direction: "IN" | "OUT"): MessageItem => {
  const peer = direction === "IN" ? m.sender : m.target;
  return { id: m.id, peerId: peer?.loginId ?? "", peerName: peer?.nickname || "알 수 없는 회원", body: m.content, sentAt: m.createdAt, read: direction === "OUT" || m.read, direction };
};

export async function flextvMailbox(params: { box?: unknown; page?: unknown; size?: unknown }): Promise<MailboxView | null> {
  const token = await getFlextvAccessToken();
  if (!token) return null;
  const box: Mailbox = params.box === "sent" ? "sent" : "inbox";
  const size = parseMessagePageSize(params.size);
  const n = Number(params.page);
  const asked = Number.isInteger(n) && n >= 1 ? n : 1;
  const [mailbox, account] = await Promise.all([fetchMailbox(token, { offset: (asked - 1) * size, limit: size }), fetchMyAccount(token)]);
  if (!mailbox || !account) return null;
  const total = box === "sent" ? mailbox.sentCount : mailbox.receivedCount;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const items = box === "sent" ? mailbox.sent.map((m) => itemOf(m, "OUT")) : mailbox.received.map((m) => itemOf(m, "IN"));
  return {
    box,
    q: "",
    items,
    page: Math.min(asked, totalPages),
    totalPages,
    size,
    total,
    counts: { inbox: mailbox.receivedCount, sent: mailbox.sentCount, archive: 0, spam: 0 },
    unread: account.unreadMessages
  };
}

/**
 * Who the member can write to: the streamers in their 즐겨찾기, and `to` (a 아이디 from a room or a reply) when it is a
 * member with a channel.
 */
export async function flextvRecipients(to?: string): Promise<Recipient[] | null> {
  const token = await getFlextvAccessToken();
  if (!token) return null;
  const favorites = await fetchFavorites(token);
  if (!favorites) return null;
  const list: Recipient[] = favorites.filter((f) => f.ownerLoginId).map((f) => ({ id: f.ownerLoginId, name: f.name }));
  if (to && LOGIN_ID.test(to) && !list.some((r) => r.id === to)) {
    const receiver = await findReceiver(to).catch(() => null);
    if (receiver) list.unshift({ id: to, name: receiver.nickname });
  }
  return [...new Map(list.map((r) => [r.id, r])).values()];
}

const SEND_ERROR: Record<string, string> = {
  BLOCKED: "상대가 쪽지를 받지 않도록 막아 두었어요.",
  SUSPENDED: "이용이 정지된 회원이에요.",
  WITHDRAWN: "탈퇴한 회원이에요.",
  REFUSED: "쪽지를 보내지 못했어요. 받는 사람을 확인해 주세요."
};

export async function flextvSendMessage(input: { to?: unknown; body?: unknown; requestId?: unknown }): Promise<MessageResult> {
  const token = await getFlextvAccessToken();
  if (!token) return { status: "UNAUTHORIZED" };
  if (typeof input.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(input.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const to = typeof input.to === "string" ? input.to.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!LOGIN_ID.test(to)) return { status: "INVALID", message: "받는 사람의 아이디를 확인해 주세요." };
  if (!body || body.length > MESSAGE_BODY_MAX) return { status: "INVALID", message: `내용을 1~${MESSAGE_BODY_MAX}자로 입력해 주세요.` };
  const account = await fetchMyAccount(token);
  if (!account) return { status: "UNAUTHORIZED" };
  const caller = requestFrom(await requestDeviceContext());
  // Nothing is awaited from the check to the record: a second send with the id waits for the first.
  const key = `${account.loginId}:${input.requestId}`;
  const now = Date.now();
  for (const [k, v] of requests) if (now - v.at > REQUEST_TTL_MS) requests.delete(k);
  const done = requests.get(key);
  if (done) return done.result;
  const result = serialize(account.loginId, async (): Promise<MessageResult> => {
    if (!account.verified) return { status: "INVALID", message: "쪽지는 FLEXTV 본인인증 후에 보낼 수 있어요. 마이페이지에서 진행해 주세요." };
    if (to.toLowerCase() === account.loginId.toLowerCase()) return { status: "INVALID", message: "나에게는 쪽지를 보낼 수 없어요." };
    if (!(await findReceiver(to))) return { status: "INVALID", message: "쪽지를 받을 수 없는 아이디예요. 방송국이 있는 회원에게만 보낼 수 있어요." };
    const sent = await sendMessage(token, to, body, caller);
    if (sent === "UNAUTHORIZED") return { status: "UNAUTHORIZED" };
    return sent === "SENT" ? { status: "SAVED" } : { status: "INVALID", message: SEND_ERROR[sent] };
  });
  requests.set(key, { at: now, result });
  // A failed or unclear send may be tried again with the same id.
  result.then(
    (r) => r.status !== "SAVED" && requests.delete(key),
    () => requests.delete(key)
  );
  return result;
}

export async function flextvMarkRead(id: unknown): Promise<MessageResult> {
  const token = await getFlextvAccessToken();
  if (!token) return { status: "UNAUTHORIZED" };
  if (typeof id !== "string" || !MESSAGE_ID.test(id)) return { status: "SAVED" };
  const change = await markRead(token, id, requestFrom(await requestDeviceContext()));
  return change === "UNAUTHORIZED" ? { status: "UNAUTHORIZED" } : { status: "SAVED" };
}

/** Deleting twice, or another's, is a no-op. */
export async function flextvDeleteMessages(ids: unknown): Promise<MessageResult> {
  const token = await getFlextvAccessToken();
  if (!token) return { status: "UNAUTHORIZED" };
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) return { status: "INVALID", message: "쪽지를 선택해 주세요." };
  const caller = requestFrom(await requestDeviceContext());
  for (const id of ids) {
    if (typeof id !== "string" || !MESSAGE_ID.test(id)) continue;
    if ((await deleteMessage(token, id, caller)) === "UNAUTHORIZED") return { status: "UNAUTHORIZED" };
  }
  return { status: "SAVED" };
}

/** Blocks the sender of a received 쪽지 (looked up on FLEXTV by the 쪽지's id). */
export async function flextvBlockSenderOf(messageId: unknown): Promise<BlockResult> {
  const token = await getFlextvAccessToken();
  if (!token) return { status: "UNAUTHORIZED" };
  if (typeof messageId !== "string" || !MESSAGE_ID.test(messageId)) return { status: "NOT_FOUND" };
  const one = await fetchMailbox(token, { offset: 0, limit: 1, messageId });
  if (!one) return { status: "UNAUTHORIZED" };
  const sender = one.received.find((m) => m.id === messageId)?.sender;
  if (!sender) return { status: "NOT_FOUND" };
  const change = await blockSender(token, sender.memberId, requestFrom(await requestDeviceContext()));
  if (change === "UNAUTHORIZED") return { status: "UNAUTHORIZED" };
  if (change === "NOT_FOUND") return { status: "INVALID", message: "이 회원은 차단할 수 없어요." };
  return { status: "OK", name: sender.nickname };
}

/** 쪽지 차단 목록; an entry's id is the blocked member's 아이디. */
export async function flextvBlocks(): Promise<BlockEntry[] | null> {
  const token = await getFlextvAccessToken();
  if (!token) return null;
  const blocks = await fetchBlocks(token, { offset: 0, limit: BLOCKS_PAGE });
  return blocks ? blocks.items.map((b) => ({ id: b.loginId, name: b.nickname, since: b.blockedAt })) : null;
}

export async function flextvUnblock(loginId: unknown): Promise<BlockResult> {
  const token = await getFlextvAccessToken();
  if (!token) return { status: "UNAUTHORIZED" };
  if (typeof loginId !== "string" || !LOGIN_ID.test(loginId)) return { status: "NOT_FOUND" };
  const blocks = await fetchBlocks(token, { offset: 0, limit: BLOCKS_PAGE });
  if (!blocks) return { status: "UNAUTHORIZED" };
  const entry = blocks.items.find((b) => b.loginId === loginId);
  if (!entry) return { status: "NOT_FOUND" };
  const change = await unblockSender(token, entry.memberId, requestFrom(await requestDeviceContext()));
  if (change === "UNAUTHORIZED") return { status: "UNAUTHORIZED" };
  if (change === "NOT_FOUND") throw new FlextvUnavailableError("FLEXTV kept the 쪽지 차단");
  return { status: "OK", name: entry.nickname };
}
