import { requestFrom, type DeviceContext } from "./auth";
import { FlextvUnavailableError, flextvRequest, isRecord, type FlextvResponse } from "./client";
import { FLEXTV_WEB_URL } from "./mode";

/**
 * FLEXTV's live broadcasting (docs/development/flextv-backend.md "4단계"): the live list, whether a stream plays in
 * FLEXTV's embeddable player for a signed-out viewer, the recent chat and sending a chat line. The `map*` and `read*`
 * functions are pure and tested in `live.test.ts`. Nothing FLEXTV sends about a member beyond a nickname and a fan
 * level is passed on (no 아이디, no room password).
 */

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null);
const text = (value: unknown) => (typeof value === "string" ? value : "");
const httpsUrl = (value: unknown) => (typeof value === "string" && /^https:\/\//.test(value) ? value : null);

/* ── The live list ───────────────────────────────────────── */

export type FlextvLive = {
  channelId: string;
  title: string;
  thumbnailUrl: string | null;
  viewers: number;
  startedAt: string | null;
  ownerNickname: string;
  ownerThumbUrl: string | null;
};

/**
 * `GET /api/channels/live-list-main` rows (public; a signed-out list has no 19+ streams). A blinded or suspended
 * stream, and one that is not on air, is left out.
 */
export function readLiveList(data: unknown): FlextvLive[] {
  const rows = isRecord(data) && Array.isArray(data.data) ? data.data : [];
  return rows.flatMap((row): FlextvLive[] => {
    if (!isRecord(row) || row.isInLive === false) return [];
    const channelId = num(row.channelId);
    if (channelId === null || channelId <= 0) return [];
    const barrier = isRecord(row.barrier) ? row.barrier : {};
    if (barrier.blind === true || barrier.suspended === true || barrier.isBanned === true) return [];
    const owner = isRecord(row.owner) ? row.owner : {};
    return [
      {
        channelId: String(channelId),
        title: text(row.title),
        thumbnailUrl: httpsUrl(row.thumbUrl),
        viewers: Math.max(0, num(row.playerCount) ?? 0),
        startedAt: typeof row.startedAt === "string" ? row.startedAt : null,
        ownerNickname: text(owner.nickname),
        ownerThumbUrl: httpsUrl(owner.thumbUrl)
      }
    ];
  });
}

export async function fetchLiveList(): Promise<FlextvLive[]> {
  const response = await flextvRequest("/api/channels/live-list-main?liveOption=total");
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV live list answered ${response.status}`);
  return readLiveList(response.data);
}

/* ── Watching ────────────────────────────────────────────── */

export type Watch =
  /** Plays in FLEXTV's embeddable player for anyone. */
  | { kind: "EMBED"; streamId: string; title: string; viewers: number | null }
  /**
   * On air, but FLEXTV lets only some viewers in (19+, password, fan grade, full room). FLEXTV's player in another site
   * is always signed out (its cookies are not sent there), so these are watched on FLEXTV.
   */
  | { kind: "ON_FLEXTV"; reason: "ADULT" | "LOCKED" | "FAN_ONLY" | "FULL" | "BANNED" }
  | { kind: "OFFLINE" };

const GATES: [string, Exclude<Watch, { kind: "EMBED" | "OFFLINE" }>["reason"]][] = [
  ["로그인후", "ADULT"],
  ["성인 전용", "ADULT"],
  ["비밀번호", "LOCKED"],
  ["팬등급", "FAN_ONLY"],
  ["풀방", "FULL"],
  ["차단된", "BANNED"]
];

/**
 * `GET /api/channels/:id/stream?option=all` asked as a signed-out viewer — what FLEXTV's player inside Ssumnation would
 * be. Only the stream id, its title and the viewer count are read; the rest (sources, the room's settings) stays here.
 */
export function mapWatch({ status, data }: Pick<FlextvResponse, "status" | "data">): Watch {
  if (status === 200 && isRecord(data)) {
    const stream = isRecord(data.stream) ? data.stream : {};
    const streamId = num(stream.id);
    if (streamId === null) return { kind: "OFFLINE" };
    const s = isRecord(data.status) ? data.status : {};
    const barrier = isRecord(s.barrier) ? s.barrier : {};
    if (barrier.isForAdult === true) return { kind: "ON_FLEXTV", reason: "ADULT" };
    if (barrier.isLocked === true) return { kind: "ON_FLEXTV", reason: "LOCKED" };
    if ((num(barrier.minRatingLevel) ?? 0) > 0) return { kind: "ON_FLEXTV", reason: "FAN_ONLY" };
    const performance = isRecord(s.performance) ? s.performance : {};
    return { kind: "EMBED", streamId: String(streamId), title: text(stream.title) || text(s.title), viewers: num(performance.viewerCount) };
  }
  if (status === 400) {
    const message = isRecord(data) && typeof data.message === "string" ? data.message : typeof data === "string" ? data : "";
    const gate = GATES.find(([needle]) => message.includes(needle));
    if (gate) return { kind: "ON_FLEXTV", reason: gate[1] };
    // "방송을 종료 했습니다", "채널 정보를 확인할 수 없습니다"
    return { kind: "OFFLINE" };
  }
  throw new FlextvUnavailableError(`FLEXTV stream answered ${status}`);
}

export async function fetchWatch(channelId: string): Promise<Watch> {
  return mapWatch(await flextvRequest(`/api/channels/${channelId}/stream?option=all`));
}

/** FLEXTV's embeddable player (no X-Frame-Options or frame-ancestors on it) and its own page for gated streams. */
export const embedPlayerUrl = (channelId: string) => `${FLEXTV_WEB_URL}/embed/channels/${channelId}/play`;
export const flextvLiveUrl = (channelId: string) => `${FLEXTV_WEB_URL}/channels/${channelId}/live`;

/* ── Chat ────────────────────────────────────────────────── */

export type FlextvChatLine = {
  /** Stable across reads (FLEXTV's lines have no id): sender, time and text. */
  key: string;
  memberId: string;
  nickname: string;
  /** FLEXTV fan level (0 none). */
  fanLevel: number;
  text: string;
  at: string;
};

/** A line is a string, or (with emoticons) a JSON array of `{type, msg}` parts. */
function lineText(value: unknown): string {
  const raw = text(value);
  if (!raw.startsWith("[")) return raw;
  try {
    const parts = JSON.parse(raw) as unknown;
    if (!Array.isArray(parts)) return raw;
    return parts.map((p) => (isRecord(p) ? (p.type === "text" ? text(p.msg) : "(이모티콘)") : "")).join("").trim();
  } catch {
    return raw;
  }
}

/** A short djb2 hash, so two lines of one member in one moment keep apart. */
function hash(value: string) {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** `GET /api/channels/:id/stream/recent/messages` (public, the newest 50, oldest first). */
export function readChat(data: unknown): FlextvChatLine[] {
  const rows = Array.isArray(data) ? data : isRecord(data) && Array.isArray(data.data) ? data.data : [];
  return rows.flatMap((row): FlextvChatLine[] => {
    if (!isRecord(row)) return [];
    const member = isRecord(row.member) ? row.member : {};
    const memberId = num(member.id);
    const line = lineText(row.text);
    const at = typeof row.createdAt === "string" ? row.createdAt : "";
    if (memberId === null || !line || !at) return [];
    return [{ key: `${memberId}-${at}-${hash(line)}`, memberId: String(memberId), nickname: text(member.nickname) || "시청자", fanLevel: num(member.level) ?? 0, text: line, at }];
  });
}

export async function fetchChat(channelId: string, streamId: string): Promise<FlextvChatLine[]> {
  const response = await flextvRequest(`/api/channels/${channelId}/stream/recent/messages?streamId=${streamId}&offset=0&limit=50`);
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV chat answered ${response.status}`);
  return readChat(response.data);
}

export type ChatSendOutcome = { kind: "SENT" } | { kind: "MUTED" } | { kind: "BLOCKED" } | { kind: "TOO_LONG" } | { kind: "INVALID" } | { kind: "UNAUTHORIZED" };

const CHAT_REFUSALS: [string, ChatSendOutcome["kind"]][] = [
  ["잠시 동안 대화를", "MUTED"],
  ["차단된 계정", "BLOCKED"],
  ["내부 정책", "BLOCKED"],
  ["글자수", "TOO_LONG"],
  ["전송할 수 없는", "INVALID"]
];

/** `POST /api/channels/:id/stream/message`: 200 "OK" is sent; an empty line answers 200 `{error}`. */
export function mapChatSend({ status, data }: Pick<FlextvResponse, "status" | "data">): ChatSendOutcome {
  if (status === 200) return isRecord(data) && data.error ? { kind: "INVALID" } : { kind: "SENT" };
  if (status === 401) return { kind: "UNAUTHORIZED" };
  if (status === 400) {
    const message = isRecord(data) && typeof data.message === "string" ? data.message : "";
    return { kind: CHAT_REFUSALS.find(([needle]) => message.includes(needle))?.[1] ?? "INVALID" } as ChatSendOutcome;
  }
  throw new FlextvUnavailableError(`FLEXTV chat send answered ${status}`);
}

export async function sendChat(token: string, context: DeviceContext, { channelId, streamId, message }: { channelId: string; streamId: string; message: string }): Promise<ChatSendOutcome> {
  const response = await flextvRequest(`/api/channels/${channelId}/stream/message`, {
    method: "POST",
    token,
    ...requestFrom(context),
    body: { streamId: Number(streamId), source: "web", message, messageType: 0 }
  });
  return mapChatSend(response);
}
