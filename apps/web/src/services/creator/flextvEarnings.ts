import { fetchReceived, fetchReceivedSummary, type ReceivedGift } from "@/lib/flextv/earnings";
import { startOfMonths, startOfWeek } from "@/lib/period";
import { bucket, eachDay, toIsoDate, type StatsPeriod } from "./creatorStats";
import type { CreatorDashboard, DashboardSummary, RankEntry, RecentDonation, RevenueOverview } from "./creatorStudio";
import { studioContext, type StudioContext } from "./flextvStudio";

/**
 * The studio's 수익 figures for a FLEXTV streamer (phase 5, docs/development/flextv-backend.md "5단계"): the dashboard,
 * 수익 현황 and the 받은 후원 list, from the 렉스 FLEXTV recorded for them. Amounts are 렉스, shown as FN.
 *
 * FLEXTV keeps no totals per period, so a period's figures add up its list — at most MAX_GIFTS 후원, newest first; a
 * busier period is marked `partial`. 오늘 · 누적 · 환전 come from FLEXTV's own summary. Only what FLEXTV counts (its
 * statuses 0 · 1 · 9) is added up; dates are FLEXTV's (KST).
 */

const PAGE = 50;
/** The most 후원 one figure adds up: 40 of FLEXTV's pages. */
export const MAX_GIFTS = 2_000;
const PARALLEL = 4;
const CACHE_MS = 60_000;
const MAX_CACHED = 200;

type Range = { gifts: ReceivedGift[]; complete: boolean };
type Cached = { at: number; range: Promise<Range> };
const g = globalThis as typeof globalThis & { __ssumnationFlextvReceived?: Map<string, Cached> };
const cache = (g.__ssumnationFlextvReceived ??= new Map());

/** Today in KST, as FLEXTV dates its rows. */
export const kstToday = (now = Date.now()) => new Date(now + 9 * 3_600_000).toISOString().slice(0, 10);
const dayOf = (iso: string) => new Date(`${iso}T00:00:00`);

/** The 후원 of [from, to] (KST dates), newest first; kept a minute per member and range. */
export function readRange(ctx: StudioContext, from: string, to: string): Promise<Range> {
  const key = `${ctx.session.userId}:${from}:${to}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.range;
  if (cache.size >= MAX_CACHED) for (const [k, e] of cache) if (now - e.at >= CACHE_MS || cache.size >= MAX_CACHED) cache.delete(k);
  const range = load(ctx.token, from, to);
  cache.set(key, { at: now, range });
  range.catch(() => cache.get(key)?.range === range && cache.delete(key));
  return range;
}

async function load(token: string, from: string, to: string): Promise<Range> {
  const first = await fetchReceived(token, { offset: 0, limit: PAGE, from, to });
  const pages = Math.ceil(Math.min(first.count, MAX_GIFTS) / PAGE);
  const rest: ReceivedGift[][] = [];
  for (let p = 1; p < pages; p += PARALLEL) {
    const batch = Array.from({ length: Math.min(PARALLEL, pages - p) }, (_, i) => fetchReceived(token, { offset: (p + i) * PAGE, limit: PAGE, from, to }).then((r) => r.items));
    rest.push(...(await Promise.all(batch)));
  }
  // A 후원 arriving while the pages are read shifts them by one: the same row may come twice.
  const seen = new Set<string>();
  const gifts = [first.items, ...rest].flat().filter((gift) => !seen.has(gift.id) && seen.add(gift.id));
  return { gifts, complete: first.count <= MAX_GIFTS };
}

/* ── Adding up (pure) ────────────────────────────────────── */

const counted = (gifts: ReceivedGift[], from?: string, to?: string) => gifts.filter((gift) => gift.counted && (!from || gift.at.slice(0, 10) >= from) && (!to || gift.at.slice(0, 10) <= to));

export function tally(gifts: ReceivedGift[], from?: string, to?: string) {
  const list = counted(gifts, from, to);
  return { amount: list.reduce((sum, gift) => sum + gift.rex, 0), count: list.length };
}

export function donorCount(gifts: ReceivedGift[], from?: string, to?: string) {
  return new Set(counted(gifts, from, to).map((gift) => gift.donorKey)).size;
}

/** Supporters by 렉스 sent, most first; a tie keeps the one who reached it first. */
export function rankDonors(gifts: ReceivedGift[], limit: number, from?: string, to?: string): RankEntry[] {
  const byDonor = new Map<string, { donor: string; amount: number; first: string }>();
  for (const gift of counted(gifts, from, to)) {
    const entry = byDonor.get(gift.donorKey) ?? { donor: gift.donorNickname, amount: 0, first: gift.at };
    entry.amount += gift.rex;
    if (gift.at < entry.first) entry.first = gift.at;
    byDonor.set(gift.donorKey, entry);
  }
  return [...byDonor.values()]
    .sort((a, b) => b.amount - a.amount || a.first.localeCompare(b.first))
    .slice(0, limit)
    .map((entry, i) => ({ rank: i + 1, donor: entry.donor, amount: entry.amount }));
}

export function dailyAmounts(gifts: ReceivedGift[], days: string[]) {
  const byDay = new Map<string, number>();
  for (const gift of counted(gifts)) byDay.set(gift.at.slice(0, 10), (byDay.get(gift.at.slice(0, 10)) ?? 0) + gift.rex);
  return days.map((date) => ({ date, amount: byDay.get(date) ?? 0 }));
}

/** A row of 최근 후원: FLEXTV's list has no message, so a 선물 상품's name stands in. */
export const recentOf = (gift: ReceivedGift): RecentDonation => ({
  id: gift.id,
  donor: gift.donorNickname,
  amount: gift.rex,
  message: gift.productName ?? "",
  createdAt: `${gift.at.replace(" ", "T")}+09:00`
});

/* ── The studio's views ──────────────────────────────────── */

/** 오늘 · 이번 주 (from Monday) · 이번 달 (from the 1st), as the mock dashboard counts them (2026-10-08 "달력 기준"). */
function windows(today: string) {
  const day = dayOf(today);
  const week = toIsoDate(startOfWeek(day));
  const month = toIsoDate(startOfMonths(1, day));
  return { today, week, month, from: week < month ? week : month };
}

export async function flextvDashboard(period: StatsPeriod): Promise<CreatorDashboard | null> {
  const ctx = await studioContext();
  if (!ctx) return null;
  const w = windows(kstToday());
  // The usual presets (오늘 · 1주일 · 1개월) fall inside this week and month: one read serves both.
  const [windowRange, latest] = await Promise.all([readRange(ctx, w.from, w.today), fetchReceived(ctx.token, { offset: 0, limit: 6 })]);
  const inWindow = period.from >= w.from && period.to <= w.today;
  const range = inWindow ? windowRange : await readRange(ctx, period.from, period.to);
  const { amount, count } = tally(range.gifts, period.from, period.to);
  return {
    period,
    unit: "FN",
    partial: !range.complete,
    stats: { count, revenue: amount, donors: donorCount(range.gifts, period.from, period.to) },
    series: bucket(dailyAmounts(range.gifts, eachDay(period.from, period.to))),
    recent: latest.items.filter((gift) => gift.counted).map(recentOf),
    rankings: {
      day: rankDonors(windowRange.gifts, 5, w.today),
      week: rankDonors(windowRange.gifts, 5, w.week),
      month: rankDonors(windowRange.gifts, 5, w.month)
    },
    banners: { event: null, ad: null }
  };
}

export async function flextvDashboardSummary(): Promise<DashboardSummary | null> {
  const ctx = await studioContext();
  if (!ctx) return null;
  const w = windows(kstToday());
  const [range, summary] = await Promise.all([readRange(ctx, w.from, w.today), fetchReceivedSummary(ctx.token)]);
  return {
    unit: "FN",
    received: {
      // 오늘 follows FLEXTV's own figure (it takes today's cancellations off); its count is the list's.
      today: { amount: summary.today, count: tally(range.gifts, w.today).count },
      week: tally(range.gifts, w.week),
      month: tally(range.gifts, w.month),
      total: { amount: summary.accumulated, count: null }
    },
    // 정산 가능 = FLEXTV's 환전 가능 렉스, 누적 수익 = 받은 렉스 누적, 누적 출금 = 환전 완료.
    settlement: { availableFn: summary.exchangeable, earnedFn: summary.accumulated, withdrawnFn: summary.exchanged },
    topDonors: rankDonors(range.gifts, 5, w.month)
  };
}

export async function flextvRevenueOverview(): Promise<RevenueOverview | null> {
  const ctx = await studioContext();
  if (!ctx) return null;
  const today = kstToday();
  const day = dayOf(today);
  const from = toIsoDate(startOfMonths(6, day));
  const [range, summary] = await Promise.all([readRange(ctx, from, today), fetchReceivedSummary(ctx.token)]);
  const last30 = Array.from({ length: 30 }, (_, i) => toIsoDate(new Date(day.getFullYear(), day.getMonth(), day.getDate() - 29 + i)));
  const daily = dailyAmounts(range.gifts, last30).map((d) => ({ label: `${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8, 10))}`, amount: d.amount }));
  const monthly = Array.from({ length: 6 }, (_, i) => {
    const first = new Date(day.getFullYear(), day.getMonth() - 5 + i, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    return { label: `${first.getMonth() + 1}월`, amount: tally(range.gifts, toIsoDate(first), toIsoDate(last)).amount };
  });
  const month = toIsoDate(startOfMonths(1, day));
  return {
    unit: "FN",
    partial: !range.complete,
    totalRevenue: summary.accumulated,
    today: { amount: summary.today, count: tally(range.gifts, today).count },
    thisMonth: tally(range.gifts, month).amount,
    unsettledFn: summary.exchangeable,
    daily,
    monthly,
    topDonors: rankDonors(range.gifts, 5, month),
    // FLEXTV's list does not tell 일반 후원 from the others, and every 후원 came through FLEXTV.
    bySource: null
  };
}

/* ── 받은 후원 (the list) ─────────────────────────────────── */

export const RECEIVED_PAGE_SIZE = 10;
export const RECEIVED_QUERY_MAX = 20;

/** A row as the browser gets it: no 아이디 of the sender. */
export type ReceivedRow = { id: string; at: string; donorNickname: string; rex: number; productName: string | null; counted: boolean };

export type FlextvReceivedPage = {
  period: { preset: string; from: string; to: string; year?: number };
  nickname: string;
  page: number;
  totalPages: number;
  /** FLEXTV's count of the rows the filters match. */
  total: number;
  items: ReceivedRow[];
  /** The period's 렉스 as FLEXTV counts them; null while searching a nickname. */
  sum: { amount: number; count: number; partial: boolean } | null;
};

const rowOf = ({ id, at, donorNickname, rex, productName, counted }: ReceivedGift): ReceivedRow => ({ id, at, donorNickname, rex, productName, counted });

/** 받은 후원 with FLEXTV: its list one page at a time, filtered by period and FLEXTV's exact 닉네임 search. */
export async function flextvReceivedPage({ period, nickname, page }: { period: FlextvReceivedPage["period"]; nickname: string; page: number }): Promise<FlextvReceivedPage | null> {
  const ctx = await studioContext();
  if (!ctx) return null;
  const name = nickname.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, RECEIVED_QUERY_MAX);
  const wanted = Number.isSafeInteger(page) && page >= 1 ? page : 1;
  const query = { limit: RECEIVED_PAGE_SIZE, from: period.from, to: period.to, nickname: name || undefined };
  const [first, range] = await Promise.all([fetchReceived(ctx.token, { ...query, offset: (wanted - 1) * RECEIVED_PAGE_SIZE }), name ? null : readRange(ctx, period.from, period.to)]);
  const totalPages = Math.max(1, Math.ceil(first.count / RECEIVED_PAGE_SIZE));
  // Past the last page (the list got shorter): show the last one.
  const shown = wanted > totalPages ? await fetchReceived(ctx.token, { ...query, offset: (totalPages - 1) * RECEIVED_PAGE_SIZE }) : first;
  return {
    period,
    nickname: name,
    page: Math.min(wanted, totalPages),
    totalPages,
    total: first.count,
    items: shown.items.map(rowOf),
    sum: range ? { ...tally(range.gifts, period.from, period.to), partial: !range.complete } : null
  };
}
