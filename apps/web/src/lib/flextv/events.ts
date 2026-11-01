import { FlextvUnavailableError, flextvRequest, isRecord } from "./client";
import { htmlToParagraphs } from "./support";

/**
 * FLEXTV's 이벤트 and 명예의 전당 (phase 9, docs/development/flextv-backend.md "9단계") — `/api/cs/event-list`,
 * `/api/cs/event-page` and `/api/events/find-hof_total_rankings` of FLEXTV's web repository. An event's text is HTML from
 * FLEXTV's editor; it is shown here as plain paragraphs and its https pictures (`htmlToBlocks`), never as HTML. Some
 * events are pages built into FLEXTV's site (a `code`); they open there. The `read*` functions are pure
 * (events.test.ts).
 */

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null);
const text = (value: unknown) => (typeof value === "string" ? value : "");
const idOf = (value: unknown) => {
  const id = num(value);
  return id !== null && id > 0 && Number.isSafeInteger(id) ? String(id) : null;
};
const httpsUrl = (value: unknown) => (typeof value === "string" && /^https:\/\/[^\s"'<>]+$/.test(value) ? value : null);
const iso = (value: unknown) => {
  const t = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

/* ── 이벤트 ──────────────────────────────────────────────── */

export type FlextvEvent = {
  id: string;
  title: string;
  /** FLEXTV's list picture (null for its default one). */
  imageUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  /** A page built into FLEXTV's site. */
  code: string | null;
};

const eventOf = (raw: Record<string, unknown>): FlextvEvent | null => {
  const id = idOf(raw.id);
  if (!id) return null;
  return { id, title: text(raw.title).trim(), imageUrl: httpsUrl(raw.imgUrl), startsAt: iso(raw.startDate), endsAt: iso(raw.endDate), code: text(raw.code).trim() || null };
};

/** `GET /api/cs/event-list`: `{ data: [{ id, title, imgUrl, startDate, endDate, code, … }], count }`, newest first. */
export function readEventList(data: unknown): { items: FlextvEvent[]; total: number } {
  const rows = isRecord(data) && Array.isArray(data.data) ? data.data : [];
  const seen = new Set<string>();
  const items = rows.flatMap((raw) => {
    const event = isRecord(raw) ? eventOf(raw) : null;
    if (!event || seen.has(event.id)) return [];
    seen.add(event.id);
    return [event];
  });
  return { items, total: Math.max(items.length, (isRecord(data) ? num(data.count) : null) ?? 0) };
}

/** FLEXTV's 진행 중 events (`option=on`) or its 종료 ones. */
export async function fetchEvents({ ended, offset, limit }: { ended: boolean; offset: number; limit: number }) {
  const response = await flextvRequest(`/api/cs/event-list?offset=${offset}&limit=${limit}&option=${ended ? "off" : "on"}`);
  if (response.status === 204) return { items: [], total: 0 };
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV event list answered ${response.status}`);
  return readEventList(response.data);
}

export type EventBlock = { kind: "text"; text: string } | { kind: "image"; src: string };

/** FLEXTV's editor HTML as paragraphs and pictures, in order. Only https pictures are kept; everything else is text. */
export function htmlToBlocks(html: string): EventBlock[] {
  const blocks: EventBlock[] = [];
  const clean = html.replace(/<\s*(script|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  const imgTag = /<\s*img\b[^>]*>/gi;
  let at = 0;
  const pushText = (part: string) => blocks.push(...htmlToParagraphs(part).map((t): EventBlock => ({ kind: "text", text: t })));
  for (let m = imgTag.exec(clean); m; m = imgTag.exec(clean)) {
    pushText(clean.slice(at, m.index));
    const src = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m[0]);
    const url = httpsUrl((src?.[1] ?? src?.[2] ?? src?.[3] ?? "").replace(/&amp;/g, "&"));
    if (url) blocks.push({ kind: "image", src: url });
    at = m.index + m[0].length;
  }
  pushText(clean.slice(at));
  return blocks;
}

export type FlextvEventPage = FlextvEvent & {
  ongoing: boolean;
  blocks: EventBlock[];
  prev: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
};

/** `GET /api/cs/event-page`: `{ events, prevevents, nextevents }`, the text as `bcontent`. */
export function readEventPage(data: unknown): FlextvEventPage | null {
  if (!isRecord(data) || !isRecord(data.events)) return null;
  const event = eventOf(data.events);
  if (!event) return null;
  const near = (raw: unknown) => {
    const e = isRecord(raw) ? eventOf(raw) : null;
    return e ? { id: e.id, title: e.title } : null;
  };
  return {
    ...event,
    ongoing: num(data.events.open) === 1,
    blocks: htmlToBlocks(text(data.events.bcontent) || text(data.events.content)),
    prev: near(data.prevevents),
    next: near(data.nextevents)
  };
}

/**
 * One event; null when FLEXTV has no such (published) event. FLEXTV answers a missing one with a server error, so the
 * list is asked then: when it answers, the event is missing; when it does not, FLEXTV is unreachable.
 */
export async function fetchEventPage(id: string): Promise<FlextvEventPage | null> {
  if (!/^[1-9]\d{0,15}$/.test(id)) return null;
  const response = await flextvRequest(`/api/cs/event-page?page=${id}`);
  if (response.status === 200) return readEventPage(response.data);
  if (response.status !== 500) throw new FlextvUnavailableError(`FLEXTV event page answered ${response.status}`);
  await fetchEvents({ ended: false, offset: 0, limit: 1 });
  return null;
}

/* ── 명예의 전당 ─────────────────────────────────────────── */

/** FLEXTV's 명예의 전당 starts with January 2026 (its page's first month). */
export const HALL_OF_FAME_FIRST_MONTH = "202601";

/** The months FLEXTV's 명예의 전당 offers up to `current` (YYYYMM), newest first. */
export function hallOfFameMonths(current: string): string[] {
  const months: string[] = [];
  let y = Number(current.slice(0, 4));
  let m = Number(current.slice(4, 6));
  while (`${y}${String(m).padStart(2, "0")}` >= HALL_OF_FAME_FIRST_MONTH && months.length < 240) {
    months.push(`${y}${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return months;
}

/** One supporter of the month. `channelId`: their own channel, when they have one. */
export type HallOfFameRow = { rank: number; nickname: string; channelId: string | null; points: number; badges: { id: number; count: number }[] };

/** `GET /api/events/find-hof_total_rankings`: up to 20 rows, most points first. Member numbers and 아이디 are left out. */
export function readHallOfFame(data: unknown): HallOfFameRow[] {
  const rows = Array.isArray(data) ? data : [];
  return rows.flatMap((raw, i) => {
    if (!isRecord(raw)) return [];
    const nickname = text(raw.nickname).trim();
    if (!nickname) return [];
    const rank = num(raw.rank);
    const badges = (Array.isArray(raw.badges) ? raw.badges : []).flatMap((b) => {
      const id = isRecord(b) ? num(b.id) : null;
      return id !== null && Number.isInteger(id) && id >= 1 && id <= 4 ? [{ id, count: Math.max(0, num((b as Record<string, unknown>).amount) ?? 0) }] : [];
    });
    return [{ rank: rank !== null && Number.isInteger(rank) && rank > 0 ? rank : i + 1, nickname, channelId: idOf(raw.channelId), points: Math.max(0, num(raw.point) ?? 0), badges }];
  });
}

export async function fetchHallOfFame(month: string): Promise<HallOfFameRow[]> {
  if (!/^\d{6}$/.test(month)) return [];
  const response = await flextvRequest(`/api/events/find-hof_total_rankings?dateAt=${month}`);
  if (response.status === 204) return [];
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV 명예의 전당 answered ${response.status}`);
  return readHallOfFame(response.data);
}

/** FLEXTV's 명예의 전당 badge pictures (its RenderBadges). */
export const HALL_OF_FAME_BADGE_IMAGES: Record<number, string> = {
  1: "https://static.flextv.co.kr/20240802/1_final_1_715442b74e.png",
  2: "https://static.flextv.co.kr/20240802/2_final_90cd33eef2.png",
  3: "https://static.flextv.co.kr/20240802/2_final_abc0c8afa8.png",
  4: "https://static.flextv.co.kr/20240802/2_final_d5c9f7f016.png"
};
