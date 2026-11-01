import { FlextvUnavailableError, flextvRequest, isRecord, type FlextvRequest, type FlextvResponse } from "./client";

/**
 * FLEXTV's channel lists and 즐겨찾기 (phase 7, docs/development/flextv-backend.md "7단계") — server/routes/api/channels
 * and subscribes of FLEXTV's web repository. FLEXTV calls a member's 즐겨찾기 "subscriptions" (its paid 구독 is another
 * thing). The `read*` · `map*` functions are pure (channels.test.ts).
 */

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null);
const text = (value: unknown) => (typeof value === "string" ? value : "");
const httpsUrl = (value: unknown) => (typeof value === "string" && /^https:\/\//.test(value) ? value : null);

/** A channel as FLEXTV's lists give it, named after its owner like the rooms and the live list. */
export type FlextvChannelRow = {
  channelId: string;
  /** The owner's nickname (the channel's name when FLEXTV has none). */
  name: string;
  description: string;
  thumbUrl: string | null;
  live: boolean;
  /** 즐겨찾기 count. */
  followers: number;
  /** Viewers right now; 0 offline. */
  viewers: number;
};

/** One row of `/api/channels/rankings`, `/searchRankings` or `/api/subscribes`; null for one without an id. */
export function readChannelRow(raw: unknown): FlextvChannelRow | null {
  if (!isRecord(raw)) return null;
  const id = num(raw.id);
  if (id === null || id <= 0 || !Number.isSafeInteger(id)) return null;
  const owner = isRecord(raw.owner) ? raw.owner : {};
  // Rankings carry `stat.numberOfSubs`, the 즐겨찾기 list `numberOfSubs` (and `stat` as a number right after adding).
  const followers = isRecord(raw.stat) ? num(raw.stat.numberOfSubs) : (num(raw.numberOfSubs) ?? num(raw.stat));
  return {
    channelId: String(id),
    name: text(owner.nickname) || text(raw.name),
    description: text(raw.description),
    thumbUrl: httpsUrl(owner.thumbUrl),
    live: raw.isInLive === true || raw.isInLive === 1,
    followers: Math.max(0, followers ?? 0),
    viewers: raw.isInLive === true || raw.isInLive === 1 ? Math.max(0, num(raw.playerCount) ?? 0) : 0
  };
}

/** `{ data: [...] }` or a bare array. */
export function readChannelRows(data: unknown): FlextvChannelRow[] {
  const rows = Array.isArray(data) ? data : isRecord(data) && Array.isArray(data.data) ? data.data : [];
  const seen = new Set<string>();
  return rows.flatMap((raw) => {
    const row = readChannelRow(raw);
    if (!row || seen.has(row.channelId)) return [];
    seen.add(row.channelId);
    return [row];
  });
}

async function list(path: string): Promise<FlextvChannelRow[]> {
  const response = await flextvRequest(path);
  if (response.status === 204) return [];
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV ${path.split("?")[0]} answered ${response.status}`);
  return readChannelRows(response.data);
}

/** This week's channel ranking (FLEXTV's 랭킹, every ranked channel), asked as a signed-out visitor. */
export const fetchRankedChannels = () => list("/api/channels/rankings?sort=all&includeAdult=false");

/** Channels whose name matches `name` (FLEXTV's 방송국 검색). */
export const searchChannels = (name: string) => list(`/api/channels/searchRankings?liveOption=total&limit=50&name=${encodeURIComponent(name)}`);

/* ── 즐겨찾기 ─────────────────────────────────────────────── */

type Caller = Pick<FlextvRequest, "clientIp" | "userAgent">;

/** The member's 즐겨찾기, live channels first; null when FLEXTV no longer accepts the token. */
export async function fetchFavorites(token: string): Promise<FlextvChannelRow[] | null> {
  const response = await flextvRequest("/api/subscribes", { token });
  if (response.status === 401) return null;
  if (response.status === 204) return [];
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV 즐겨찾기 answered ${response.status}`);
  return readChannelRows(response.data);
}

/** `GET /api/subscribes/:id/check`: the row when the member has it, an empty 204 otherwise. */
export function mapFavoriteCheck({ status, data }: Pick<FlextvResponse, "status" | "data">): boolean | null {
  if (status === 401) return null;
  if (status === 204 || (status === 200 && data === null)) return false;
  if (status === 200 && isRecord(data)) return true;
  throw new FlextvUnavailableError(`FLEXTV 즐겨찾기 check answered ${status}`);
}

export async function checkFavorite(token: string, channelId: string): Promise<boolean | null> {
  return mapFavoriteCheck(await flextvRequest(`/api/subscribes/${channelId}/check`, { token }));
}

export type FavoriteChange = "DONE" | "UNCLEAR" | "UNAUTHORIZED";

/**
 * `POST /api/subscribes` answers the added channel (an array), or "FAIL" — already there, no such channel, or an error;
 * `DELETE /api/subscribes/:id` answers "OK" (also when it was not there) or "FAIL". An unclear answer is settled by
 * the caller with checkFavorite.
 */
export function mapFavoriteChange({ status, data }: Pick<FlextvResponse, "status" | "data">): FavoriteChange {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 200 && (Array.isArray(data) || data === "OK")) return "DONE";
  if (status === 200 || status === 400) return "UNCLEAR";
  throw new FlextvUnavailableError(`FLEXTV 즐겨찾기 change answered ${status}`);
}

export async function addFavorite(token: string, channelId: string, caller: Caller): Promise<FavoriteChange> {
  return mapFavoriteChange(await flextvRequest("/api/subscribes", { method: "POST", body: { targetId: Number(channelId) }, token, ...caller }));
}

export async function removeFavorite(token: string, channelId: string, caller: Caller): Promise<FavoriteChange> {
  return mapFavoriteChange(await flextvRequest(`/api/subscribes/${channelId}`, { method: "DELETE", token, ...caller }));
}
