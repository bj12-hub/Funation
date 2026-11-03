import { FlextvUnavailableError, flextvRequest, isRecord, type FlextvRequest, type FlextvResponse } from "./client";

/**
 * The streamer's controls over their live room on FLEXTV (phase 10, docs/development/flextv-backend.md "10단계"): who is
 * watching, and what FLEXTV's own chat menu does — 채팅 금지 (FLEXTV lifts it after 60 seconds), 내보내기 (once; they may
 * come back) and 채팅 얼리기 for everyone but the streamer and managers. FLEXTV checks the caller is the channel's owner
 * or a manager above the viewer. Viewers' member numbers stay on the server: the studio names a viewer by 아이디. The
 * `read*` and `map*` functions are pure (liveControl.test.ts).
 */

type Caller = Pick<FlextvRequest, "clientIp" | "userAgent">;

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null);
const text = (value: unknown) => (typeof value === "string" ? value : "");

export type ViewerRole = "OWNER" | "MANAGER" | "HOT_FAN" | "FAN" | "VIEWER";

/** One member in the room now. `memberId` is for FLEXTV's calls only. */
export type StreamViewer = { memberId: number; loginId: string; nickname: string; role: ViewerRole; fanLevel: number; muted: boolean };

/**
 * `GET /api/channels/:id/stream/players?offset&limit`: the members in the room, in FLEXTV's order (방송인, 매니저, 열혈팬,
 * 구독, 팬, 시청자), each with `role.channel` (O 방송인, M 매니저), its 열혈팬 `ranking` (1–20), 팬 `level` and `isDumb`.
 */
export function readViewers(data: unknown): StreamViewer[] {
  const rows = Array.isArray(data) ? data : isRecord(data) && Array.isArray(data.data) ? data.data : [];
  const seen = new Set<number>();
  return rows.flatMap((row): StreamViewer[] => {
    if (!isRecord(row)) return [];
    const memberId = num(row.id);
    const loginId = text(row.loginId).trim();
    if (memberId === null || !Number.isSafeInteger(memberId) || memberId <= 0 || !loginId || seen.has(memberId)) return [];
    seen.add(memberId);
    const role = isRecord(row.role) ? row.role : {};
    const ranking = num(row.ranking) ?? -1;
    const fanLevel = Math.max(0, num(row.level) ?? 0);
    const kind: ViewerRole = role.channel === "O" ? "OWNER" : role.channel === "M" ? "MANAGER" : ranking >= 1 && ranking <= 20 ? "HOT_FAN" : fanLevel >= 1 ? "FAN" : "VIEWER";
    return [{ memberId, loginId, nickname: text(row.nickname).trim() || loginId, role: kind, fanLevel, muted: row.isDumb === true }];
  });
}

/** The first 50, as FLEXTV's own list shows them. */
export async function fetchViewers(channelId: string, token: string): Promise<StreamViewer[]> {
  const response = await flextvRequest(`/api/channels/${channelId}/stream/players?offset=0&limit=50`, { token });
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV players answered ${response.status}`);
  return readViewers(response.data);
}

/** `GET /api/channels/:id/stream/player-count-accumulate`: `{ data: n }`, everyone who watched this stream. */
export async function fetchViewerTotal(channelId: string): Promise<number | null> {
  const response = await flextvRequest(`/api/channels/${channelId}/stream/player-count-accumulate`);
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV viewer total answered ${response.status}`);
  const count = num(isRecord(response.data) ? response.data.data : null);
  return count === null ? null : Math.max(0, Math.floor(count));
}

export type StreamState = { startedAt: string | null; frozen: boolean };

/** `GET /api/channels/:id/stream?option=all`: when the stream started and whether its chat is frozen (`stream.isFrozen`). */
export function readStreamState(data: unknown): StreamState | null {
  if (!isRecord(data) || !isRecord(data.stream)) return null;
  const status = isRecord(data.status) ? data.status : {};
  const started = [status.startedAt, data.stream.createdAt].find((v) => typeof v === "string" && Number.isFinite(Date.parse(v)));
  return { startedAt: typeof started === "string" ? new Date(started).toISOString() : null, frozen: data.stream.isFrozen === true || data.stream.isFrozen === 1 };
}

export async function fetchStreamState(channelId: string, token: string): Promise<StreamState | null> {
  const response = await flextvRequest(`/api/channels/${channelId}/stream?option=all`, { token });
  if (response.status === 400) return null;
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV stream answered ${response.status}`);
  return readStreamState(response.data);
}

export type ControlOutcome = "OK" | "REFUSED" | "UNAUTHORIZED";

/** FLEXTV answers "OK", 400 when the viewer is not someone the caller may act on, 401/403 when the caller may not. */
export function mapControl({ status, data }: Pick<FlextvResponse, "status" | "data">): ControlOutcome {
  if (status === 401 || status === 403) return "UNAUTHORIZED";
  if (status === 200 && (data === "OK" || data === null || data === "")) return "OK";
  if (status === 400) return "REFUSED";
  throw new FlextvUnavailableError(`FLEXTV live control answered ${status}`);
}

/** `POST /api/channels/:id/stream/kick`: out of the room once (FLEXTV does not keep them out). */
export async function kickViewer(token: string, channelId: string, memberId: number, caller: Caller): Promise<ControlOutcome> {
  return mapControl(await flextvRequest(`/api/channels/${channelId}/stream/kick`, { method: "POST", body: { memberId }, token, ...caller }));
}

/** `POST /api/channels/:id/stream/dumb`: 채팅 금지 on or off; FLEXTV lifts it after 60 seconds. */
export async function muteViewer(token: string, channelId: string, memberId: number, on: boolean, caller: Caller): Promise<ControlOutcome> {
  return mapControl(await flextvRequest(`/api/channels/${channelId}/stream/dumb`, { method: "POST", body: { memberId, isDumb: on }, token, ...caller }));
}

/** `POST /api/channels/:id/stream/freeze` (the owner only): FLEXTV turns 채팅 얼리기 over — on when off, off when on. */
export async function toggleFreeze(token: string, channelId: string, caller: Caller): Promise<ControlOutcome> {
  return mapControl(await flextvRequest(`/api/channels/${channelId}/stream/freeze`, { method: "POST", token, ...caller }));
}
