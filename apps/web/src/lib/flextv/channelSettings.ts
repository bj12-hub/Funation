import { FlextvUnavailableError, flextvRequest, isRecord, type FlextvRequest, type FlextvResponse } from "./client";
import { LINK_PLATFORMS, type LinkPlatform } from "./rules";

/**
 * 채널 설정 on FLEXTV (phase 7, docs/development/flextv-backend.md "7단계"): the streamer's 방송국 이름 · 소개 · 배너
 * (`PUT /api/my/channel/profile`, multipart) and its links (`GET · POST /api/my/channel/external-link`) — server/routes/
 * api/my/channel.js of FLEXTV's web repository. FLEXTV's own form rules are kept (its channel-setting page). The `read*`
 * · `map*` functions are pure (channelSettings.test.ts).
 */

/** FLEXTV's five free links (`title1` · `link1` …), kept as they are when the platforms are saved. */
const EXTRA_KEYS = [1, 2, 3, 4, 5].flatMap((n) => [`title${n}`, `link${n}`]);

export type ChannelLinks = { platforms: Record<LinkPlatform, string>; extra: Record<string, string> };

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** `GET /api/my/channel/external-link`: the links without the empty ones, or `[]` when none were ever saved. */
export function readLinks(data: unknown): ChannelLinks {
  const raw = isRecord(data) ? data : {};
  return {
    platforms: Object.fromEntries(LINK_PLATFORMS.map((k) => [k, text(raw[k])])) as Record<LinkPlatform, string>,
    extra: Object.fromEntries(EXTRA_KEYS.map((k) => [k, text(raw[k])]))
  };
}

export async function fetchLinks(token: string): Promise<ChannelLinks | null> {
  const response = await flextvRequest("/api/my/channel/external-link", { token });
  if (response.status === 401) return null;
  if (response.status === 204) return readLinks(null);
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV links answered ${response.status}`);
  return readLinks(response.data);
}

type Caller = Pick<FlextvRequest, "clientIp" | "userAgent">;

export type ChannelChange = "OK" | "UNAUTHORIZED";

/** FLEXTV answers its channel changes with "OK" (the links with the saved object). */
export function mapChannelChange({ status, data }: Pick<FlextvResponse, "status" | "data">): ChannelChange {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 200 && (data === "OK" || isRecord(data) || Array.isArray(data))) return "OK";
  throw new FlextvUnavailableError(`FLEXTV channel change answered ${status}`);
}

/** Every field is sent: FLEXTV writes each one it is given, so the free links go back as they were. */
export async function saveLinks(token: string, links: ChannelLinks, caller: Caller): Promise<ChannelChange> {
  return mapChannelChange(await flextvRequest("/api/my/channel/external-link", { method: "POST", body: { ...links.extra, ...links.platforms }, token, ...caller }));
}

/** `GET /api/my/channel/:name` answers "ok" or "overlap". */
export function mapNameCheck({ status, data }: Pick<FlextvResponse, "status" | "data">): "AVAILABLE" | "TAKEN" | "UNAUTHORIZED" {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 200 && data === "ok") return "AVAILABLE";
  if (status === 200 && data === "overlap") return "TAKEN";
  throw new FlextvUnavailableError(`FLEXTV channel name check answered ${status}`);
}

export async function checkChannelName(token: string, name: string) {
  return mapNameCheck(await flextvRequest(`/api/my/channel/${encodeURIComponent(name)}`, { token }));
}

/**
 * One change per call, as FLEXTV's form sends them: FLEXTV updates the name or the 소개 (each through its forbidden-word
 * filter) but not both at once, and decodes the name it is sent.
 */
export async function updateChannel(token: string, change: { name: string } | { description: string } | { banner: Blob; filename: string }, caller: Caller): Promise<ChannelChange> {
  const form = new FormData();
  if ("name" in change) form.set("name", encodeURIComponent(change.name));
  else if ("description" in change) form.set("description", change.description);
  else form.set("image", change.banner, change.filename);
  return mapChannelChange(await flextvRequest("/api/my/channel/profile", { method: "PUT", form, token, ...caller }));
}
