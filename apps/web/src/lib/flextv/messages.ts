import { FlextvUnavailableError, flextvRequest, isRecord, type FlextvRequest, type FlextvResponse } from "./client";

/**
 * FLEXTV's 쪽지 (phase 9, docs/development/flextv-backend.md "9단계") — server/routes/api/my (`/messages`,
 * `/member-messages-black*`) of FLEXTV's web repository. A 쪽지 goes to a 아이디; FLEXTV takes one only from a member who
 * did its 본인인증, and only to a member with a channel (a streamer). The `read*` · `map*` functions are pure
 * (messages.test.ts).
 */

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null);
const text = (value: unknown) => (typeof value === "string" ? value : "");
const httpsUrl = (value: unknown) => (typeof value === "string" && /^https:\/\//.test(value) ? value : null);
const idOf = (value: unknown) => {
  const id = num(value);
  return id !== null && id > 0 && Number.isSafeInteger(id) ? String(id) : null;
};
const iso = (value: unknown) => {
  const t = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
};

export type MessageParty = { memberId: string; loginId: string; nickname: string; thumbUrl: string | null };
export type FlextvMessage = { id: string; content: string; createdAt: string; read: boolean; sender: MessageParty | null; target: MessageParty | null; blocked: boolean };
export type FlextvMailbox = { received: FlextvMessage[]; sent: FlextvMessage[]; receivedCount: number; sentCount: number };

const party = (value: unknown): MessageParty | null => {
  if (!isRecord(value)) return null;
  const memberId = idOf(value.id);
  if (!memberId) return null;
  return { memberId, loginId: text(value.loginId), nickname: text(value.nickname) || text(value.loginId), thumbUrl: httpsUrl(value.thumbUrl) };
};

/**
 * A 쪽지's text. FLEXTV's own 쪽지 (gifts, events) are stored as URI-encoded JSON with a `title`; a member's is the text
 * itself.
 */
export function messageText(content: string): string {
  if (!/^%7B/i.test(content)) return content;
  try {
    const decoded: unknown = JSON.parse(decodeURIComponent(content));
    if (isRecord(decoded) && typeof decoded.title === "string") return decoded.title;
    if (isRecord(decoded) && typeof decoded.content === "string") return decoded.content;
  } catch {
    // Not FLEXTV's JSON after all: the text as it is.
  }
  return content;
}

const messageOf = (raw: unknown): FlextvMessage | null => {
  if (!isRecord(raw)) return null;
  const id = idOf(raw.id);
  if (!id) return null;
  return { id, content: messageText(text(raw.content)), createdAt: iso(raw.createdAt), read: num(raw.hasRead) === 1 || raw.hasRead === true, sender: party(raw.sender), target: party(raw.target), blocked: raw.isBlack === true };
};

/** `GET /api/my/messages`: `{ recipientData, sendData, recipientCount, sendCount }` (both folders, a page each). */
export function readMailbox(data: unknown): FlextvMailbox {
  const b = isRecord(data) ? data : {};
  const list = (value: unknown) => (Array.isArray(value) ? value.flatMap((m) => messageOf(m) ?? []) : []);
  return { received: list(b.recipientData), sent: list(b.sendData), receivedCount: Math.max(0, num(b.recipientCount) ?? 0), sentCount: Math.max(0, num(b.sendCount) ?? 0) };
}

/** Both folders, a page each (`received` alone with one 쪽지 when `messageId` is given); null signed out. */
export async function fetchMailbox(token: string, page: { offset: number; limit: number; messageId?: string }): Promise<FlextvMailbox | null> {
  const one = page.messageId ? `&division=recipient&msgId=${page.messageId}` : "";
  const response = await flextvRequest(`/api/my/messages?offset=${page.offset}&limit=${page.limit}${one}`, { token });
  if (response.status === 401) return null;
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV 쪽지 answered ${response.status}`);
  return readMailbox(response.data);
}

type Caller = Pick<FlextvRequest, "clientIp" | "userAgent">;

export type MessageSend = "SENT" | "BLOCKED" | "SUSPENDED" | "WITHDRAWN" | "REFUSED" | "UNAUTHORIZED";

/**
 * `POST /api/my/messages` answers "OK"; "Black" (the receiver blocked the sender), "stoped" · "withdrawal" (a 휴면 or
 * 탈퇴 member), or "FAIL" — no 본인인증, no such member, a receiver without a channel or one whose channel blocked the
 * sender, or FLEXTV's own 쪽지 block. Ssumnation checks the first three before sending.
 */
export function mapSend({ status, data }: Pick<FlextvResponse, "status" | "data">): MessageSend {
  if (status === 401) return "UNAUTHORIZED";
  if (status !== 200 || typeof data !== "string") throw new FlextvUnavailableError(`FLEXTV 쪽지 send answered ${status}`);
  if (data === "OK") return "SENT";
  if (data === "Black") return "BLOCKED";
  if (data === "stoped") return "SUSPENDED";
  if (data === "withdrawal") return "WITHDRAWN";
  if (data === "FAIL") return "REFUSED";
  throw new FlextvUnavailableError("FLEXTV 쪽지 send answered an unknown value");
}

export async function sendMessage(token: string, loginId: string, content: string, caller: Caller): Promise<MessageSend> {
  return mapSend(await flextvRequest("/api/my/messages", { method: "POST", body: { loginId, content }, token, ...caller }));
}

/**
 * The member of `loginId` when they have a channel — FLEXTV takes 쪽지 only for those (`GET /api/channels/channel-find`
 * answers 404 for an unknown 아이디 and for a member without a channel).
 */
export async function findReceiver(loginId: string): Promise<{ channelId: string; nickname: string } | null> {
  const response = await flextvRequest(`/api/channels/channel-find?loginId=${encodeURIComponent(loginId)}`);
  if (response.status === 404 || response.status === 400) return null;
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV member lookup answered ${response.status}`);
  const channelId = isRecord(response.data) ? idOf(response.data.id) : null;
  return channelId && isRecord(response.data) ? { channelId, nickname: text(response.data.nickname) || loginId } : null;
}

/** `POST /api/my/messages/read/:id` ("OK" · "FAIL"), `GET /api/my/messages/delete?id=` ("ok", or nothing for another's). */
export function mapChange({ status, data }: Pick<FlextvResponse, "status" | "data">): "DONE" | "NOT_FOUND" | "UNAUTHORIZED" {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 204 || (status === 200 && (data === "FAIL" || data === "fail" || data === null))) return "NOT_FOUND";
  if (status === 200 && (data === "OK" || data === "ok")) return "DONE";
  throw new FlextvUnavailableError(`FLEXTV 쪽지 change answered ${status}`);
}

export async function markRead(token: string, messageId: string, caller: Caller) {
  return mapChange(await flextvRequest(`/api/my/messages/read/${messageId}`, { method: "POST", token, ...caller }));
}

export async function deleteMessage(token: string, messageId: string, caller: Caller) {
  return mapChange(await flextvRequest(`/api/my/messages/delete?id=${messageId}`, { token, ...caller }));
}

/* ── 쪽지 차단 ───────────────────────────────────────────── */

export type BlockedSender = { memberId: string; loginId: string; nickname: string; thumbUrl: string | null; blockedAt: string };

/** `GET /api/my/member-messages-blackList`: `{ data: [{ targetId, loginId, nickname, thumbUrl, createdAt }], count }`. */
export function readBlocks(data: unknown): { items: BlockedSender[]; total: number } {
  const b = isRecord(data) ? data : {};
  const rows = Array.isArray(b.data) ? b.data : [];
  return {
    items: rows.flatMap((r) => {
      const memberId = isRecord(r) ? idOf(r.targetId) : null;
      if (!memberId || !isRecord(r)) return [];
      return [{ memberId, loginId: text(r.loginId), nickname: text(r.nickname) || text(r.loginId), thumbUrl: httpsUrl(r.thumbUrl), blockedAt: iso(r.createdAt) }];
    }),
    total: Math.max(0, num(b.count) ?? 0)
  };
}

export async function fetchBlocks(token: string, page: { offset: number; limit: number }) {
  const response = await flextvRequest(`/api/my/member-messages-blackList?offset=${page.offset}&limit=${page.limit}`, { token });
  if (response.status === 401) return null;
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV 쪽지 차단 answered ${response.status}`);
  return readBlocks(response.data);
}

export async function blockSender(token: string, memberId: string, caller: Caller) {
  return mapChange(await flextvRequest("/api/my/member-messages-blackAdd", { method: "POST", body: { targetId: Number(memberId) }, token, ...caller }));
}

export async function unblockSender(token: string, memberId: string, caller: Caller) {
  return mapChange(await flextvRequest("/api/my/member-messages-blackDelete", { method: "DELETE", body: { targetId: Number(memberId) }, token, ...caller }));
}
