import { FlextvUnavailableError, flextvRequest, isRecord } from "./client";

/**
 * A FLEXTV channel's 소식 and 팬 랭킹 for its room (phase 9, docs/development/flextv-backend.md "9단계") —
 * `/api/channels/:id/channel-notices` and `/api/channels/:id/fans` of FLEXTV's web repository. The room shows what
 * FLEXTV's own channel page lists: a 소식's title, picture and marks (its text, comments and 구독자 전용 rule are on
 * FLEXTV's page), and the month's fans in order with their 팬 등급, without amounts. The `read*` functions are pure
 * (room.test.ts).
 */

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null);
const text = (value: unknown) => (typeof value === "string" ? value : "");
const httpsUrl = (value: unknown) => (typeof value === "string" && /^https:\/\//.test(value) ? value : null);
const flag = (value: unknown) => value === true || (num(value) ?? 0) > 0;
const channelPath = (channelId: string) => {
  if (!/^[1-9]\d{0,15}$/.test(channelId)) throw new FlextvUnavailableError("not a FLEXTV channel id");
  return `/api/channels/${channelId}`;
};

/** One 소식 (FLEXTV's BJ톡) as FLEXTV's channel page lists it. */
export type FlextvNewsItem = {
  id: string;
  title: string;
  /** FLEXTV's list picture (its 19 picture for an adult post the member may not see). */
  imageUrl: string | null;
  /** 필독 — FLEXTV lists these first. */
  important: boolean;
  adult: boolean;
  createdAt: string;
  views: number;
};

/** `{ data: [...] }` of `/channel-notices`, in FLEXTV's order (필독 first, then the newest). */
export function readNews(data: unknown): FlextvNewsItem[] {
  const rows = isRecord(data) && Array.isArray(data.data) ? data.data : [];
  const seen = new Set<string>();
  return rows.flatMap((raw) => {
    if (!isRecord(raw)) return [];
    const id = num(raw.id);
    const createdAt = text(raw.createdAt);
    // Comments (`parent` set) are not 소식.
    if (id === null || id <= 0 || !Number.isSafeInteger(id) || seen.has(String(id)) || num(raw.parent) || Number.isNaN(Date.parse(createdAt))) return [];
    seen.add(String(id));
    return [
      {
        id: String(id),
        title: text(raw.title).trim(),
        imageUrl: httpsUrl(raw.imageUrl),
        important: flag(raw.important),
        adult: flag(raw.adult),
        createdAt,
        views: Math.max(0, num(raw.viewCount) ?? 0)
      }
    ];
  });
}

/**
 * The channel's latest `limit` 소식. Asked with the member's token when there is one, so FLEXTV applies its own
 * rules for them (its channel blacklist, adult pictures); `ver=0` skips FLEXTV's count, which the room does not use.
 */
export async function fetchNews(channelId: string, limit: number, token?: string): Promise<FlextvNewsItem[]> {
  const path = `${channelPath(channelId)}/channel-notices?offset=0&limit=${limit}&sort=recent&ver=0`;
  let response = await flextvRequest(path, { token });
  // A token FLEXTV no longer accepts: the list as a visitor sees it.
  if (response.status === 401 && token) response = await flextvRequest(path);
  if (response.status === 204) return [];
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV channel-notices answered ${response.status}`);
  return readNews(response.data);
}

/** One row of the channel's 팬 랭킹. */
export type FlextvFan = { loginId: string; nickname: string; levelName: string };

/** `{ data: [...] }` of `/fans`, in FLEXTV's order (most given first). */
export function readFans(data: unknown): FlextvFan[] {
  const rows = isRecord(data) && Array.isArray(data.data) ? data.data : [];
  const seen = new Set<string>();
  return rows.flatMap((raw) => {
    if (!isRecord(raw) || !isRecord(raw.member)) return [];
    const loginId = text(raw.member.loginId);
    const nickname = text(raw.member.nickname).trim();
    if (!loginId || !nickname || seen.has(loginId)) return [];
    seen.add(loginId);
    return [{ loginId, nickname, levelName: text(raw.name).trim() }];
  });
}

/** This month's top `limit` fans, asked as a signed-out visitor: FLEXTV then leaves the amounts out for everyone. */
export async function fetchFans(channelId: string, limit = 10): Promise<FlextvFan[]> {
  const response = await flextvRequest(`${channelPath(channelId)}/fans?option=month&offset=0&limit=${limit}`);
  if (response.status === 204) return [];
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV fans answered ${response.status}`);
  return readFans(response.data);
}
