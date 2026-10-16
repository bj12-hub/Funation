import type { Platform } from "@/types/platform";
import { PlatformError, type PlatformErrorCode } from "./platformTypes";

/**
 * Mock "remote" for FlexTV's received-donation history (내역 이관, 2026-10-16) — server-only, used by adapters.ts and
 * the tests. FlexTV's real history API (paging, how far back, rate limits, auth) is TBD; this shape is deliberately
 * FlexTV's own (giftNo · sender · price · currency · memo · giftedAt) so the adapter maps it explicitly.
 */

export type FlexGiftHistoryDto = {
  giftNo: number | string;
  sender: { id: string; nick: string };
  price: number | string;
  /** "KRW" in the mock; anything else is mapped to FlexTV's placeholder unit (TBD). */
  currency?: string;
  memo: string;
  /** ISO time with the Korea offset. */
  giftedAt: string;
};

export type FlexGiftHistoryPageDto = { list: FlexGiftHistoryDto[]; nextToken: string | null; more: boolean };

/** Mock page size (FlexTV's is TBD). */
export const FLEX_HISTORY_PAGE = 20;

type HistoryRemote = {
  channels: Record<string, FlexGiftHistoryDto[]>;
  /** Test hooks: the next history call fails (or never answers), after `afterCalls` successful calls. */
  failNext: Partial<Record<Platform, { code: PlatformErrorCode | "HANG"; afterCalls: number }>>;
};

const g = globalThis as typeof globalThis & { __ssumnationMockHistoryRemoteV1?: HistoryRemote };
const remote = (): HistoryRemote => (g.__ssumnationMockHistoryRemoteV1 ??= { channels: {}, failNext: {} });

const NICKS = ["별빛소나기", "새벽라디오", "콩떡이", "달토끼", "구름빵", "초코칩", "파란하늘", "고양이집사", "여행가고파", "노을빛"];
const MEMOS = ["오늘 방송 최고!", "", "노래 한 곡 부탁해요", "응원합니다", "", "생일 축하해요", "게임 화이팅", ""];
const PRICES = [1_000, 3_000, 5_000, 10_000, 1_000, 2_000, 50_000, 5_000];

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** "2026-09-01T20:15:03+09:00" for an instant. */
const kstIso = (ms: number) => `${new Date(ms + 9 * 3_600_000).toISOString().slice(0, 19)}+09:00`;

/**
 * The channel's history, oldest first: a deterministic sample (45 donations over the 120 days before the first read,
 * fictional donors) plus what tests append.
 */
export function flexHistoryOf(channelId: string): FlexGiftHistoryDto[] {
  const r = remote();
  if (!Object.hasOwn(r.channels, channelId)) {
    const h = hash(channelId);
    const end = Date.now() - 3_600_000;
    r.channels[channelId] = Array.from({ length: 45 }, (_, i) => ({
      giftNo: 7_000_000 + (h % 100_000) * 100 + i,
      sender: { id: `fx-${(h + i) % 997}`, nick: NICKS[(h + i * 7) % NICKS.length] },
      price: PRICES[(h + i) % PRICES.length],
      currency: "KRW",
      memo: MEMOS[(h + i * 3) % MEMOS.length],
      giftedAt: kstIso(end - (44 - i) * 2.6 * 86_400_000 - ((h >>> (i % 16)) % 3_600) * 1_000)
    }));
  }
  return r.channels[channelId];
}

/** Mock only: a donation lands in the channel's history (tests use it for new items, malformed DTOs and redelivery). */
export function mockFlexHistoryAppend(channelId: string, dto: FlexGiftHistoryDto) {
  flexHistoryOf(channelId).push(dto);
}

/** Test hook: the next history call to this platform fails with `code` ("HANG" = never answers) after `afterCalls`. */
export function mockFailNextHistoryCall(platform: Platform, code: PlatformErrorCode | "HANG", afterCalls = 0) {
  remote().failNext[platform] = { code, afterCalls };
}

/** Throws (or hangs) when a failure is armed for this call. */
export function consumeHistoryFailure(platform: Platform): Promise<never> | null {
  const f = remote().failNext[platform];
  if (!f) return null;
  if (f.afterCalls > 0) {
    f.afterCalls--;
    return null;
  }
  delete remote().failNext[platform];
  if (f.code === "HANG") return new Promise<never>(() => undefined);
  return Promise.reject(new PlatformError(f.code, f.code.toLowerCase()));
}

/** The remote call: a page after `nextToken` ("o:<index>"), oldest first; `since` limits the first page's start. */
export async function flexFetchGiftHistory(channelId: string, nextToken: string | null, since: string | null): Promise<FlexGiftHistoryPageDto> {
  const list = flexHistoryOf(channelId);
  const token = nextToken ? /^o:(\d{1,9})$/.exec(nextToken) : null;
  let start = token ? Math.min(Number(token[1]), list.length) : 0;
  if (!token && since) {
    const from = Date.parse(since);
    const first = list.findIndex((d) => Date.parse(d.giftedAt) >= from);
    start = first < 0 ? list.length : first;
  }
  const page = list.slice(start, start + FLEX_HISTORY_PAGE);
  const next = start + page.length;
  return { list: page.map((d) => structuredClone(d)), nextToken: `o:${next}`, more: next < list.length };
}
