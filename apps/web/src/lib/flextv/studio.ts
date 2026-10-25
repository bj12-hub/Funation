import { requestFrom, type DeviceContext } from "./auth";
import { FlextvUnavailableError, flextvRequest, isRecord, type FlextvResponse } from "./client";

/**
 * FLEXTV's broadcaster API (docs/development/flextv-backend.md "5단계"): becoming a streamer, the member's channel and
 * its open stream, the OBS stream keys, and starting, changing and ending a broadcast. The `read*` and `map*` functions
 * are pure and tested in `studio.test.ts`.
 *
 * FLEXTV hands the room password and the stream key to its owner. Here the password stays on the server (`secret`,
 * only sent back to FLEXTV when a change keeps it), and the key is read only when the owner asks to see it.
 */

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null);
const text = (value: unknown) => (typeof value === "string" ? value : "");
/** FLEXTV mixes booleans, 0/1 and "0"/"1" for its switches. */
const on = (value: unknown) => value === true || (num(value) ?? 0) > 0;

/* ── Becoming a streamer ─────────────────────────────────── */

export type StreamerStatus =
  /** 본사 소속 (2) or 엔터 소속 (3): FLEXTV lets them broadcast. */
  | { kind: "STREAMER" }
  | { kind: "ELIGIBLE" }
  /** No 본인인증 yet. FLEXTV's own site does it (its return address is FLEXTV's). */
  | { kind: "IDENTITY_REQUIRED" }
  /** Under 14 (FLEXTV `isAdultCheck` 4). */
  | { kind: "UNDER_AGE" }
  /** A member who declared themselves foreign: FLEXTV approves foreign streamers through 1:1 문의. */
  | { kind: "FOREIGNER" };

/** From `GET /api/my/profile`, in the order FLEXTV's 방송하기 button checks (`BroadcastLink`). */
export function readStreamerStatus(data: unknown): StreamerStatus | null {
  const profile = isRecord(data) && isRecord(data.profile) ? data.profile : null;
  if (!profile) return null;
  if (profile.memberDiv === 2 || profile.memberDiv === 3) return { kind: "STREAMER" };
  if (!profile.PI) return { kind: "IDENTITY_REQUIRED" };
  if (profile.isCustomForeigner === true) return { kind: "FOREIGNER" };
  const level = num(profile.isAdultCheck);
  return level !== null && level <= 3 ? { kind: "ELIGIBLE" } : { kind: "UNDER_AGE" };
}

/** Whether the member is 19+ (FLEXTV `isAdultCheck` 1): only they may set a 연령제한 broadcast or theme. */
export function readAdult(data: unknown): boolean {
  const profile = isRecord(data) && isRecord(data.profile) ? data.profile : null;
  return !!profile && num(profile.isAdultCheck) === 1;
}

export async function fetchMemberProfile(token: string): Promise<unknown | null> {
  const response = await flextvRequest("/api/my/profile", { token });
  if (response.status === 401) return null;
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV profile answered ${response.status}`);
  return response.data;
}

export type RegisterOutcome = { kind: "REGISTERED" } | { kind: "NOT_VERIFIED" } | { kind: "FOREIGNER" } | { kind: "REFUSED" } | { kind: "UNAUTHORIZED" };

/**
 * `POST /api/my/chennel-register`: makes the member's stream key and, for a 일반 member, records the automatic approval
 * and makes them 본사 소속 (2). "ok" = a key already existed (nothing changed), "waiting" = done.
 */
export function mapRegister({ status, data }: Pick<FlextvResponse, "status" | "data">): RegisterOutcome {
  if (status === 200 && (data === "waiting" || data === "ok")) return { kind: "REGISTERED" };
  if (status === 401) return { kind: "UNAUTHORIZED" };
  if (status === 403) {
    const message = text(data);
    if (message.includes("해외")) return { kind: "FOREIGNER" };
    // "성인인증이 완료되지 않은 회원입니다.": no 본인인증, or under 14.
    if (message.includes("성인인증")) return { kind: "NOT_VERIFIED" };
    return { kind: "REFUSED" };
  }
  throw new FlextvUnavailableError(`FLEXTV streamer registration answered ${status}`);
}

export async function registerStreamer(token: string, context: DeviceContext): Promise<RegisterOutcome> {
  return mapRegister(await flextvRequest("/api/my/chennel-register", { method: "POST", token, ...requestFrom(context) }));
}

/* ── The member's channel ────────────────────────────────── */

export type DisplayMode = "landscape" | "portrait";

export type StreamSettings = {
  title: string;
  themeId: string | null;
  tagCodes: string[];
  forAdult: boolean;
  hasPassword: boolean;
  /** 탐방허용 */
  visitAllow: boolean;
  watermark: boolean;
  /** 녹화 방지 경고 */
  recordingWarning: boolean;
  adultThumbnail: boolean;
  displayMode: DisplayMode;
};

export type ChannelSuspension = { permanent: boolean; until: string | null; reason: string | null };

export type MyChannel = {
  channelId: string;
  name: string;
  /** On air (FLEXTV `isInLive`). */
  live: boolean;
  /** The stream that has not ended yet: on air, or waiting for OBS to reconnect until 방송 종료. */
  stream: (StreamSettings & { streamId: string }) | null;
  /** The last broadcast's settings, the starting point of the next one (as FLEXTV's form does). */
  last: StreamSettings | null;
  suspension: ChannelSuspension | null;
};

function readSettings(raw: unknown): StreamSettings | null {
  if (!isRecord(raw)) return null;
  const tags = Array.isArray(raw.tag) ? raw.tag : [];
  const tagCodes = tags.flatMap((t) => {
    const code = isRecord(t) ? t.code : t;
    return typeof code === "string" || typeof code === "number" ? [String(code)] : [];
  });
  return {
    title: text(raw.title),
    themeId: raw.themeId === null || raw.themeId === undefined || raw.themeId === "" ? null : String(raw.themeId),
    tagCodes: tagCodes.slice(0, 3),
    forAdult: on(raw.isForAdult),
    hasPassword: typeof raw.password === "string" && raw.password !== "",
    visitAllow: on(raw.visitAllow),
    watermark: on(raw.useWatermark),
    recordingWarning: on(raw.useRecordingwarning),
    adultThumbnail: on(raw.useAdultThumbnail),
    displayMode: raw.displayMode === "portrait" ? "portrait" : "landscape"
  };
}

/** `channelStop` is sent while a 정지 applies; a past release date is read as over. */
export function readSuspension(raw: unknown, now = Date.now()): ChannelSuspension | null {
  if (!isRecord(raw)) return null;
  const permanent = raw.status === 2;
  const until = typeof raw.releaseDate === "string" && raw.releaseDate ? raw.releaseDate : null;
  if (!permanent && until && Number.isFinite(Date.parse(until)) && Date.parse(until) <= now) return null;
  return { permanent, until: permanent ? null : until, reason: typeof raw.suspendedDesc === "string" && raw.suspendedDesc ? raw.suspendedDesc : null };
}

/** `GET /api/my/channel/profile`. */
export function readMyChannel(data: unknown, now = Date.now()): MyChannel | null {
  if (!isRecord(data)) return null;
  const id = num(data.id);
  if (id === null || !Number.isSafeInteger(id) || id <= 0) return null;
  const open = isRecord(data.stream) ? data.stream : null;
  const streamId = open ? num(open.id) : null;
  const settings = open && streamId !== null ? readSettings(open) : null;
  return {
    channelId: String(id),
    name: text(data.name),
    live: on(data.isInLive),
    stream: settings && streamId !== null ? { ...settings, streamId: String(streamId) } : null,
    last: readSettings(data.laststreams),
    suspension: readSuspension(data.channelStop, now)
  };
}

/** The open stream's room password, for a change that keeps it (FLEXTV replaces every field it is sent). */
export function readOpenStreamPassword(data: unknown): string {
  return isRecord(data) && isRecord(data.stream) ? text(data.stream.password) : "";
}

export async function fetchMyChannelData(token: string): Promise<unknown | null> {
  const response = await flextvRequest("/api/my/channel/profile", { token });
  if (response.status === 401) return null;
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV channel answered ${response.status}`);
  return response.data;
}

/* ── Form options ────────────────────────────────────────── */

export type Option = { value: string; label: string };

/** FLEXTV's 성인 theme: its form offers it to 19+ members only. */
export const ADULT_THEME = "7";

/** `GET /api/guest/themes` and `/api/guest/refcode/:key` rows: `{ key, value, text }`. */
export function readRefOptions(data: unknown): Option[] {
  const rows = Array.isArray(data) ? data : [];
  return rows.flatMap((row) => {
    if (!isRecord(row)) return [];
    const value = typeof row.value === "string" || typeof row.value === "number" ? String(row.value) : "";
    return value && typeof row.text === "string" && row.text ? [{ value, label: row.text }] : [];
  });
}

/** `GET /api/my/channel/tag` rows: `{ code, des }`. */
export function readTags(data: unknown): Option[] {
  const rows = Array.isArray(data) ? data : [];
  return rows.flatMap((row) => {
    if (!isRecord(row)) return [];
    const value = typeof row.code === "string" || typeof row.code === "number" ? String(row.code) : "";
    return value && typeof row.des === "string" && row.des ? [{ value, label: row.des }] : [];
  });
}

const THEMES_TTL_MS = 10 * 60 * 1000;
const g = globalThis as typeof globalThis & { __ssumnationFlextvThemes?: { at: number; options: Option[] } };

export async function fetchThemes(): Promise<Option[]> {
  const cached = g.__ssumnationFlextvThemes;
  if (cached && Date.now() - cached.at < THEMES_TTL_MS) return cached.options;
  const response = await flextvRequest("/api/guest/themes?device=web");
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV themes answered ${response.status}`);
  const options = readRefOptions(response.data);
  if (options.length > 0) g.__ssumnationFlextvThemes = { at: Date.now(), options };
  return options;
}

export async function fetchTags(token: string): Promise<Option[]> {
  const response = await flextvRequest("/api/my/channel/tag", { token });
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV tags answered ${response.status}`);
  return readTags(response.data);
}

/* ── Stream keys ─────────────────────────────────────────── */

/** The engines FLEXTV's own broadcast page offers: 짧은 지연 (LL-HLS) and 일반. */
export const STREAM_ENGINES = ["ncp_llh", "ncp"] as const;
export type StreamEngine = (typeof STREAM_ENGINES)[number];
export const isStreamEngine = (value: unknown): value is StreamEngine => STREAM_ENGINES.includes(value as StreamEngine);

export type StreamKey = { engine: StreamEngine; serverUrl: string; streamKey: string };

/** `GET /api/my/channel/stream-key-sets`: `[{ url, streamKey, engine }]`, OBS's 서버 and 스트림 키. */
export function readStreamKeys(data: unknown): StreamKey[] {
  const rows = Array.isArray(data) ? data : [];
  const keys = new Map<StreamEngine, StreamKey>();
  for (const row of rows) {
    if (!isRecord(row) || !isStreamEngine(row.engine) || keys.has(row.engine)) continue;
    if (typeof row.url !== "string" || !/^rtmps?:\/\/\S+$/.test(row.url)) continue;
    if (typeof row.streamKey !== "string" || !row.streamKey.trim()) continue;
    keys.set(row.engine, { engine: row.engine, serverUrl: row.url, streamKey: row.streamKey });
  }
  return STREAM_ENGINES.flatMap((engine) => keys.get(engine) ?? []);
}

/** Only for a member FLEXTV already lets broadcast: a new streamer's key comes from `registerStreamer`. */
export async function fetchStreamKeys(token: string): Promise<StreamKey[]> {
  const response = await flextvRequest("/api/my/channel/stream-key-sets", { token });
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV stream keys answered ${response.status}`);
  return readStreamKeys(response.data);
}

export const readEngine = (data: unknown): StreamEngine | null => (isRecord(data) && isStreamEngine(data.engine) ? data.engine : null);

export async function fetchEngine(token: string): Promise<StreamEngine | null> {
  const response = await flextvRequest("/api/my/channel/streams/latest/engine", { token });
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV engine answered ${response.status}`);
  return readEngine(response.data);
}

/** `ownChannelId` is the member's own channel as FLEXTV reported it, never a value from the browser. */
export async function setEngine(token: string, context: DeviceContext, ownChannelId: string, engine: StreamEngine): Promise<boolean> {
  const response = await flextvRequest("/api/my/channel/update-stream-engine", {
    method: "POST",
    token,
    ...requestFrom(context),
    body: { channelId: Number(ownChannelId), engineEngine: engine }
  });
  if (response.status === 200) return true;
  if (response.status >= 500) throw new FlextvUnavailableError(`FLEXTV engine change answered ${response.status}`);
  return false;
}

/* ── Start · change · end ────────────────────────────────── */

export const RESOLUTIONS = ["1080", "720", "480"] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

export type StreamForm = {
  title: string;
  themeId: string;
  tagCodes: string[];
  forAdult: boolean;
  password: string;
  visitAllow: boolean;
  watermark: boolean;
  recordingWarning: boolean;
  adultThumbnail: boolean;
  displayMode: DisplayMode;
  resolution: Resolution;
};

/**
 * The fields FLEXTV's own form sends for a PC broadcast, without its test and item options; 팬방송 (`minRatingLevel`)
 * is off as FLEXTV has it now.
 */
export function streamBody(form: StreamForm, engine: StreamEngine) {
  return {
    title: form.title,
    theme: form.themeId,
    tag: form.tagCodes,
    minRatingLevel: 0,
    password: form.password,
    isForAdult: form.forAdult,
    visitAllow: form.visitAllow,
    isWatermark: form.watermark,
    isRecordingwarning: form.recordingWarning,
    isAdultThumbnail: form.forAdult && form.adultThumbnail ? 1 : 0,
    displayMode: form.displayMode,
    resolution: form.resolution,
    useRtc: false,
    useGame: 0,
    useAltThumbUrl: 0,
    viewerCount: 50000,
    engine
  };
}

export type StreamOutcome =
  | { kind: "OK" }
  | { kind: "UNAUTHORIZED" }
  /** OBS is not sending to FLEXTV yet: FLEXTV starts a broadcast only on a live signal. */
  | { kind: "NO_SIGNAL" }
  | { kind: "NOT_LIVE" }
  | { kind: "SUSPENDED" }
  /** Not a streamer, or 연령제한 by a member under 19. */
  | { kind: "NOT_ALLOWED" }
  | { kind: "RETRY" }
  /** Any other refusal, with FLEXTV's own message when it sent a short one. */
  | { kind: "REFUSED"; message: string | null };

const KNOWN: [string, StreamOutcome][] = [
  ["송출되고 있지 않습니다", { kind: "NO_SIGNAL" }],
  ["방송중인 방송이 없습니다", { kind: "NOT_LIVE" }],
  ["중지된 방송", { kind: "SUSPENDED" }],
  ["방송 승인이 되지 않은", { kind: "NOT_ALLOWED" }],
  ["잠시후에 시도", { kind: "RETRY" }]
];

/** `POST start-stream` · `PUT streams/:id` · `POST stop-stream`: "OK", or a 400 with FLEXTV's message. */
export function mapStreamAnswer({ status, data }: Pick<FlextvResponse, "status" | "data">): StreamOutcome {
  if (status === 200 && data === "OK") return { kind: "OK" };
  if (status === 401) return { kind: "UNAUTHORIZED" };
  if (status === 400) {
    const message = text(data).trim();
    const known = KNOWN.find(([needle]) => message.includes(needle));
    if (known) return known[1];
    // FLEXTV's messages are written for its members (its own form shows them as they come).
    return { kind: "REFUSED", message: message && message.length <= 100 && /[가-힣]/.test(message) ? message : null };
  }
  throw new FlextvUnavailableError(`FLEXTV stream call answered ${status}`);
}

export async function startStream(token: string, context: DeviceContext, form: StreamForm, engine: StreamEngine): Promise<StreamOutcome> {
  return mapStreamAnswer(await flextvRequest("/api/my/channel/start-stream", { method: "POST", token, ...requestFrom(context), body: streamBody(form, engine) }));
}

/** `streamId` is the member's own open stream as FLEXTV just reported it. */
export async function editStream(token: string, context: DeviceContext, streamId: string, form: StreamForm, engine: StreamEngine): Promise<StreamOutcome> {
  if (!/^\d+$/.test(streamId)) throw new Error("A stream id is a FLEXTV number.");
  const { isAdultThumbnail, ...rest } = streamBody(form, engine);
  return mapStreamAnswer(
    await flextvRequest(`/api/my/channel/streams/${streamId}`, {
      method: "PUT",
      token,
      ...requestFrom(context),
      // FLEXTV's change reads the adult thumbnail switch under both names.
      body: { ...rest, isAdultThumbnail, useAdultThumbnail: isAdultThumbnail }
    })
  );
}

export async function stopStream(token: string, context: DeviceContext): Promise<StreamOutcome> {
  return mapStreamAnswer(await flextvRequest("/api/my/channel/stop-stream", { method: "POST", token, ...requestFrom(context) }));
}
