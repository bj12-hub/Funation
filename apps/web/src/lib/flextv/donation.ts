import { requestFrom, type DeviceContext } from "./auth";
import { FlextvUnavailableError, flextvRequest, isRecord, type FlextvResponse } from "./client";
import { sendChat } from "./live";

/**
 * FLEXTV's 후원 (docs/development/flextv-backend.md "3단계"): the channel a donation goes to, its signatures, and
 * `POST /api/luv/send` as FLEXTV's own donate form sends it. The `map*` and `read*` functions are pure and tested in
 * `donation.test.ts`.
 */

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null);
const text = (value: unknown) => (typeof value === "string" ? value : "");
const httpsUrl = (value: unknown) => (typeof value === "string" && /^https:\/\//.test(value) ? value : null);

/** A FLEXTV channel id (`channels.id`): what `/creators/[id]` takes for a FLEXTV creator and what a donation goes to. */
export const isFlextvChannelId = (value: unknown): value is string => typeof value === "string" && /^[1-9]\d{0,17}$/.test(value);

/* ── The channel ─────────────────────────────────────────── */

export type FlextvChannel = {
  channelId: string;
  name: string;
  description: string;
  backgroundUrl: string | null;
  live: boolean;
  /** 즐겨찾기 count (FLEXTV's `stat.numberOfSubs`). */
  followers: number;
  owner: { memberId: number; loginId: string; nickname: string; thumbUrl: string | null; /** Did FLEXTV's 본인인증: only then can they receive. */ verified: boolean };
};

/** `GET /api/channels/:id/profile` (public). */
export function readChannel(data: unknown): FlextvChannel | null {
  if (!isRecord(data) || !isRecord(data.owner)) return null;
  const id = num(data.id);
  const memberId = num(data.owner.id);
  if (id === null || memberId === null) return null;
  return {
    channelId: String(id),
    name: text(data.name),
    description: text(data.description),
    backgroundUrl: httpsUrl(data.backgroundImgUrl),
    live: data.isInLive === true,
    followers: Math.max(0, (isRecord(data.stat) ? num(data.stat.numberOfSubs) : null) ?? 0),
    owner: {
      memberId,
      loginId: text(data.owner.loginId),
      nickname: text(data.owner.nickname) || text(data.name),
      thumbUrl: httpsUrl(data.owner.thumbUrl),
      verified: data.owner.PI !== null && data.owner.PI !== undefined && data.owner.PI !== false
    }
  };
}

export async function fetchChannel(channelId: string): Promise<FlextvChannel | null> {
  const response = await flextvRequest(`/api/channels/${channelId}/profile`);
  // BAD_ID · INVALID_CHANNEL_ID · INVALID_CHANNEL_STATUS
  if (response.status === 400 || response.status === 404) return null;
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV channel answered ${response.status}`);
  return readChannel(response.data);
}

export type FlextvStream = { streamId: string; title: string };

/** `GET /api/channels/:id/active-stream`: the stream on air, or null (204) when the channel is offline. */
export function readActiveStream({ status, data }: Pick<FlextvResponse, "status" | "data">): FlextvStream | null {
  if (status === 204 || !isRecord(data)) return null;
  const id = num(data.id);
  return id === null ? null : { streamId: String(id), title: text(data.title) };
}

export async function fetchActiveStream(channelId: string): Promise<FlextvStream | null> {
  const response = await flextvRequest(`/api/channels/${channelId}/active-stream`);
  if (response.status !== 200 && response.status !== 204) return null;
  return readActiveStream(response);
}

/* ── Signatures ──────────────────────────────────────────── */

export type FlextvSignature = { code: string; name: string; amount: number; imageUrl: string };

/**
 * `GET /api/channels/:id/gift-types`: the channel's own signature images (`img.host`, approved by FLEXTV) with their
 * fixed amounts. FLEXTV's common, level and mission images are its own decorations and are not offered.
 */
export function readSignatures(data: unknown): FlextvSignature[] {
  const host = isRecord(data) && isRecord(data.img) && Array.isArray(data.img.host) ? data.img.host : [];
  return host.flatMap((item): FlextvSignature[] => {
    if (!isRecord(item)) return [];
    const code = text(item.code);
    const amount = num(item.amount);
    const imageUrl = httpsUrl(item.imgUrl);
    if (!code || amount === null || amount <= 0 || !Number.isInteger(amount) || !imageUrl) return [];
    return [{ code, name: text(item.name) || `${amount}`, amount, imageUrl }];
  });
}

export async function fetchSignatures(channelId: string, token: string | null): Promise<FlextvSignature[]> {
  const response = await flextvRequest(`/api/channels/${channelId}/gift-types`, token ? { token } : {});
  return response.status === 200 ? readSignatures(response.data) : [];
}

/* ── Sending ─────────────────────────────────────────────── */

export type SendOutcome =
  | { kind: "SENT" }
  | { kind: "INSUFFICIENT" }
  /** FLEXTV wants its 본인인증 first. */
  | { kind: "IDENTITY_REQUIRED" }
  /** FLEXTV does not let this account donate (under 17). */
  | { kind: "NOT_ALLOWED" }
  /** The channel blocked this member. */
  | { kind: "BLOCKED" }
  /** FLEXTV asks this member to verify again (its security gate). */
  | { kind: "REAUTH_REQUIRED" }
  /** The channel does not exist, or its owner cannot receive (no 본인인증) — FLEXTV answers both the same. */
  | { kind: "RECIPIENT_UNAVAILABLE" }
  | { kind: "REFUSED"; message: string };

/** FLEXTV's 400 messages on `/api/luv/send` (`luv.helpers.js` · `luv.store.js`), translated to 'ko' without its locale cookie. */
const SEND_REFUSALS: [string, SendOutcome["kind"]][] = [
  ["선물할 수 없는 금액", "INSUFFICIENT"],
  ["본인인증", "IDENTITY_REQUIRED"],
  ["선물할 수 없는 계정", "NOT_ALLOWED"],
  ["차단된 계정", "BLOCKED"],
  ["재인증이 필요한", "REAUTH_REQUIRED"],
  ["잘못된 입력값", "RECIPIENT_UNAVAILABLE"]
];

/**
 * 200 "OK" is sent. A 400 is a refusal before anything was debited. Anything else — a 500, a timeout — is unknown:
 * FLEXTV debits first and runs its side effects after, so the 렉스 may be gone; the caller reconciles.
 */
export function mapSend({ status, data }: Pick<FlextvResponse, "status" | "data">): SendOutcome {
  if (status === 200) return { kind: "SENT" };
  if (status === 400) {
    const message = isRecord(data) && typeof data.message === "string" ? data.message : typeof data === "string" ? data : "";
    const match = SEND_REFUSALS.find(([needle]) => message.includes(needle));
    return match ? ({ kind: match[1] } as SendOutcome) : { kind: "REFUSED", message };
  }
  throw new FlextvUnavailableError(`FLEXTV donation answered ${status}`);
}

/**
 * `POST /api/luv/send` as FLEXTV's donate form sends it: `count` 1 (FLEXTV debits `amount` but checks `amount × count`),
 * a signature by its `code`, the message as the TTS effect (FLEXTV has no message field; its voice choice is ignored
 * by its server, so the default voice).
 */
export async function sendDonation(
  token: string,
  context: DeviceContext,
  { channelId, amount, signatureCode, message, video = null }: { channelId: string; amount: number; signatureCode: string | null; message: string; video?: VideoEffect | null }
): Promise<SendOutcome> {
  const response = await flextvRequest("/api/luv/send", {
    method: "POST",
    token,
    ...requestFrom(context),
    body: {
      channelId: Number(channelId),
      amount,
      count: 1,
      // 영상 후원 as FLEXTV's own 영상후원 form sends it: the YouTube effect plays on the streamer's 도우미 (FLEXTV's
      // single `effect` would take its place, so none is sent with it).
      ...(video
        ? { sendType: "youtube", effects: [{ type: "youtube", params: { url: video.url, startSec: video.startSec, endSec: video.endSec } }] }
        : { sendType: "default", ...(message ? { effect: { type: "tts", params: { actorId: "", message } } } : {}) }),
      ...(signatureCode ? { code: signatureCode } : {})
    }
  });
  return mapSend(response);
}

/* ── 영상 후원 (phase 6) ─────────────────────────────────── */

export type VideoEffect = { url: string; startSec: number; endSec: number };

/** The streamer's 영상 후원 setting on FLEXTV's 도우미: on/off, 렉스 per second, minimum, longest range. */
export type MediaSetting = { enabled: boolean; perSecond: number; minAmount: number; maxSec: number };

/**
 * `GET /api/luv/effect-settings?channelId`: `[{ type: "youtube" | "sound", enabled, maxLength, minAmount, unitAmount }]`.
 * Only 영상 (youtube): FLEXTV's 음성 is an uploaded sound file, not Ssumnation's YouTube-as-sound.
 */
export function readVideoSetting(data: unknown): MediaSetting | null {
  const row = (Array.isArray(data) ? data : []).find((r) => isRecord(r) && r.type === "youtube");
  if (!isRecord(row)) return null;
  const n = (value: unknown) => (typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null);
  const perSecond = n(row.unitAmount);
  const minAmount = n(row.minAmount);
  const maxSec = n(row.maxLength);
  if (perSecond === null || minAmount === null || maxSec === null) return null;
  return { enabled: row.enabled === true, perSecond, minAmount, maxSec };
}

export async function fetchVideoSetting(channelId: string): Promise<MediaSetting | null> {
  const response = await flextvRequest(`/api/luv/effect-settings?channelId=${encodeURIComponent(channelId)}`);
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV effect settings answered ${response.status}`);
  return readVideoSetting(response.data);
}

/** FLEXTV shows the message in chat too, as its own form does (lib/flextv/live.ts `sendChat`). Best effort. */
export async function postChatMessage(token: string, context: DeviceContext, line: { channelId: string; streamId: string; message: string }) {
  await sendChat(token, context, line).catch(() => null);
}
