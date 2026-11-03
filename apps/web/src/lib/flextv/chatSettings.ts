import { FlextvUnavailableError, flextvRequest, isRecord, type FlextvRequest, type FlextvResponse } from "./client";

export { BAN_WORD_MAX, CHAT_NOTICE_MAX } from "./rules";

/**
 * 채팅 관리 on FLEXTV (phase 9, docs/development/flextv-backend.md "9단계") — the streamer's chat pop-up 공지 and 규칙,
 * the channel's 금지어, 매니저 and 블랙리스트, and the YouTube live chat FLEXTV brings into the channel's chat:
 * server/routes/api/my/channel.js and api/channels/channel.js of FLEXTV's web repository. FLEXTV's limits are kept
 * (lib/flextv/rules.ts). The `read*` · `map*` functions are pure (chatSettings.test.ts).
 */

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null);
const text = (value: unknown) => (typeof value === "string" ? value : "");
const idOf = (value: unknown) => {
  const id = num(value);
  return id !== null && id > 0 && Number.isSafeInteger(id) ? String(id) : null;
};
const iso = (value: unknown) => (typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : "");

type Caller = Pick<FlextvRequest, "clientIp" | "userAgent">;

/* ── 채팅 공지 · 채팅 규칙 ─────────────────────────────────── */

/** The 공지 and 규칙 viewers see in the chat's pop-up, from the streamer's channel (`GET /api/my/channel/profile`). */
export function readChatTexts(data: unknown): { notice: string; rule: string } {
  const raw = isRecord(data) ? data : {};
  return { notice: text(raw.broadcastNotice), rule: text(raw.broadcastRule) };
}

export type ChatChange = "OK" | "UNAUTHORIZED";

/** FLEXTV answers the streamer's chat changes with "OK" ("ok" for the 금지어); 401 · 403: not the channel's owner now. */
export function mapChatChange({ status, data }: Pick<FlextvResponse, "status" | "data">): ChatChange {
  if (status === 401 || status === 403) return "UNAUTHORIZED";
  if (status === 200 && (data === "OK" || data === "ok")) return "OK";
  throw new FlextvUnavailableError(`FLEXTV chat change answered ${status}`);
}

/** An empty text takes the 공지 (or 규칙) away; FLEXTV filters forbidden words out of what it keeps. */
export async function saveChatText(token: string, channelId: string, which: "notice" | "rule", message: string, caller: Caller): Promise<ChatChange> {
  const path = `/api/my/channel/broadcast/${channelId}/${which === "notice" ? "channel-notice" : "rule"}`;
  return mapChatChange(await flextvRequest(path, { method: "PUT", body: { message }, token, ...caller }));
}

/* ── 금지어 ──────────────────────────────────────────────── */

export type BanWord = { id: string; word: string };

/** `GET …/ban-word-list`: the channel's rows `{ id, channelId, text }`, oldest first. */
export function readBanWords(data: unknown): BanWord[] {
  const rows = Array.isArray(data) ? data : [];
  const seen = new Set<string>();
  return rows.flatMap((raw) => {
    if (!isRecord(raw)) return [];
    const id = idOf(raw.id);
    const word = text(raw.text).trim();
    if (!id || !word || seen.has(id)) return [];
    seen.add(id);
    return [{ id, word }];
  });
}

export async function fetchBanWords(token: string, channelId: string): Promise<BanWord[] | null> {
  const response = await flextvRequest(`/api/my/channel/broadcast/${channelId}/ban-word-list`, { token });
  if (response.status === 401 || response.status === 403) return null;
  if (response.status === 204) return [];
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV ban words answered ${response.status}`);
  return readBanWords(response.data);
}

/** FLEXTV keeps one of each word (adding one again changes nothing). */
export async function addBanWord(token: string, channelId: string, word: string, caller: Caller): Promise<ChatChange> {
  return mapChatChange(await flextvRequest(`/api/my/channel/broadcast/${channelId}/ban-word-add`, { method: "POST", body: { message: word }, token, ...caller }));
}

export async function removeBanWord(token: string, channelId: string, id: string, caller: Caller): Promise<ChatChange> {
  return mapChatChange(await flextvRequest(`/api/my/channel/broadcast/${channelId}/ban-word-del/${id}`, { method: "DELETE", token, ...caller }));
}

/* ── 매니저 · 블랙리스트 ──────────────────────────────────── */

/** A member on the channel's 매니저 or 블랙리스트. `memberId` stays on the server (FLEXTV removes by it). */
export type ChannelMember = { memberId: string; loginId: string; nickname: string; since: string };

/** `GET /api/channels/:id/managers` · `/blacklist`: `[{ memberId, createdAt, member: { loginId, nickname, … } }]`. */
export function readChannelMembers(data: unknown): ChannelMember[] {
  const rows = Array.isArray(data) ? data : [];
  const seen = new Set<string>();
  return rows.flatMap((raw) => {
    if (!isRecord(raw)) return [];
    const member = isRecord(raw.member) ? raw.member : {};
    const memberId = idOf(raw.memberId) ?? idOf(member.id);
    const loginId = text(member.loginId);
    if (!memberId || !loginId || seen.has(memberId)) return [];
    seen.add(memberId);
    return [{ memberId, loginId, nickname: text(member.nickname) || loginId, since: iso(raw.createdAt) }];
  });
}

export type MemberList = "managers" | "blacklist";

export async function fetchChannelMembers(token: string, channelId: string, list: MemberList): Promise<ChannelMember[] | null> {
  const response = await flextvRequest(`/api/channels/${channelId}/${list}`, { token });
  if (response.status === 401 || response.status === 403) return null;
  if (response.status === 204) return [];
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV ${list} answered ${response.status}`);
  return readChannelMembers(response.data);
}

export type MemberChange = "OK" | "NO_MEMBER" | "SELF" | "ALREADY" | "REFUSED" | "UNAUTHORIZED";

/**
 * FLEXTV's answers to adding someone: "OK", or 400 with its reason — no such member, the streamer themself, already on
 * the list, or a member FLEXTV does not let the channel list (its own staff).
 */
export function mapMemberChange({ status, data }: Pick<FlextvResponse, "status" | "data">): MemberChange {
  if (status === 401 || status === 403) return "UNAUTHORIZED";
  if (status === 200 && data === "OK") return "OK";
  if (status === 400) {
    const reason = typeof data === "string" ? data : isRecord(data) ? text(data.message) : "";
    if (reason.includes("존재하지 않는 사용자")) return "NO_MEMBER";
    if (reason.includes("본인")) return "SELF";
    if (reason.includes("이미")) return "ALREADY";
    return "REFUSED";
  }
  throw new FlextvUnavailableError(`FLEXTV member change answered ${status}`);
}

export async function addChannelMember(token: string, channelId: string, list: MemberList, loginId: string, caller: Caller): Promise<MemberChange> {
  return mapMemberChange(await flextvRequest(`/api/channels/${channelId}/${list}`, { method: "POST", body: { loginId }, token, ...caller }));
}

export async function removeChannelMember(token: string, channelId: string, list: MemberList, memberId: string, caller: Caller): Promise<MemberChange> {
  return mapMemberChange(await flextvRequest(`/api/channels/${channelId}/${list}/${memberId}`, { method: "DELETE", token, ...caller }));
}

/* ── 유튜브 채팅 연결 ─────────────────────────────────────── */

export type YoutubeChatLink = {
  kind: "channelId" | "handle" | "videoId";
  value: string;
  /** What the streamer entered. */
  raw: string;
  /** Off: FLEXTV still receives the YouTube chat but does not show it in the channel's chat. */
  showInChat: boolean;
  savedAt: string | null;
};

const LINK_KINDS = ["channelId", "handle", "videoId"] as const;

/** `GET /api/my/channel/youtube-chat-link`: `{ kind, value, raw, notification, savedAt }`, or nothing. */
export function readYoutubeLink(data: unknown): YoutubeChatLink | null {
  if (!isRecord(data)) return null;
  const kind = LINK_KINDS.find((k) => k === data.kind);
  const value = text(data.value);
  if (!kind || !value) return null;
  const savedAt = num(data.savedAt);
  return { kind, value, raw: text(data.raw) || value, showInChat: data.notification !== false, savedAt: savedAt && savedAt > 0 ? new Date(savedAt).toISOString() : null };
}

export async function fetchYoutubeLink(token: string): Promise<YoutubeChatLink | null | "UNAUTHORIZED"> {
  const response = await flextvRequest("/api/my/channel/youtube-chat-link", { token });
  if (response.status === 401) return "UNAUTHORIZED";
  if (response.status === 204) return null;
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV youtube chat link answered ${response.status}`);
  return readYoutubeLink(response.data);
}

export type YoutubeLinkChange = { kind: "OK" } | { kind: "INVALID"; message: string } | { kind: "UNAUTHORIZED" };

/** FLEXTV answers a saved link with it, a refusal with 400 and its reason (not a YouTube channel address …). */
export function mapYoutubeLinkChange({ status, data }: Pick<FlextvResponse, "status" | "data">): YoutubeLinkChange {
  if (status === 401) return { kind: "UNAUTHORIZED" };
  if (status === 200 && (data === "OK" || readYoutubeLink(data) !== null)) return { kind: "OK" };
  if (status === 400) {
    const reason = typeof data === "string" ? data : isRecord(data) ? text(data.message) : "";
    return { kind: "INVALID", message: reason || "유튜브 채널 주소를 확인해 주세요." };
  }
  throw new FlextvUnavailableError(`FLEXTV youtube chat link change answered ${status}`);
}

export async function saveYoutubeLink(token: string, url: string, caller: Caller): Promise<YoutubeLinkChange> {
  return mapYoutubeLinkChange(await flextvRequest("/api/my/channel/youtube-chat-link", { method: "POST", body: { url }, token, ...caller }));
}

export async function removeYoutubeLink(token: string, caller: Caller): Promise<YoutubeLinkChange> {
  return mapYoutubeLinkChange(await flextvRequest("/api/my/channel/youtube-chat-link", { method: "DELETE", token, ...caller }));
}

export async function showYoutubeChat(token: string, show: boolean, caller: Caller): Promise<YoutubeLinkChange> {
  return mapYoutubeLinkChange(await flextvRequest("/api/my/channel/youtube-chat-link/notification", { method: "PUT", body: { notification: show }, token, ...caller }));
}
