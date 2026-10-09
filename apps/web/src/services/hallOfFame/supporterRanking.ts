import { USE_MOCK, mockDelay } from "@/lib/mock";
import type { GlobalTitleKey } from "@/services/supporter/identityTypes";

/**
 * Supporter ranking contract.
 * Figma: ssumnation-hall-of-fame 3:637 (route `/hall-of-fame`)
 *
 * Amounts and tiers come from the server's aggregated donation records; the client only displays them.
 * A row's tier is the supporter's 누적 등급 (2026-10-08 등급 구조, services/supporter/identityTypes.ts) — its thresholds
 * and the aggregation rules are TBD.
 */

/** 리더보드 periods — funnation 명예의 전당 (누적 · 이번 달 · 이번 주). 과거 기록 is TBD. */
export type RankingPeriod = "all" | "month" | "week";

export const RANKING_PERIOD_LABEL: Record<RankingPeriod, string> = {
  all: "누적",
  month: "이번 달",
  week: "이번 주"
};

export const DEFAULT_RANKING_PERIOD: RankingPeriod = "all";

/** 명예의 전당 tabs — funnation order (칭호 갤러리 first). */
export const HOF_TABS = [
  { key: "titles", label: "칭호 갤러리" },
  { key: "leaderboard", label: "리더보드" },
  { key: "live", label: "실시간 랭킹" }
] as const;
export type HofTab = (typeof HOF_TABS)[number]["key"];
export const parseHofTab = (v: unknown): HofTab => (HOF_TABS.some((t) => t.key === v) ? (v as HofTab) : "titles");

/** 실시간 랭킹 windows (funnation: 최근 30분 · 1시간 · 3시간 · 6시간). */
export const LIVE_WINDOWS = [
  { key: "30m", label: "최근 30분" },
  { key: "1h", label: "최근 1시간" },
  { key: "3h", label: "최근 3시간" },
  { key: "6h", label: "최근 6시간" }
] as const;
export type LiveWindow = (typeof LIVE_WINDOWS)[number]["key"];
export const parseLiveWindow = (v: unknown): LiveWindow => (LIVE_WINDOWS.some((w) => w.key === v) ? (v as LiveWindow) : "30m");

/** Rows per 리더보드 "더 보기" step. */
export const LEADERBOARD_STEP = 20;

/** The supporter's 누적 등급 (다이아 · 블랙 line); null below 다이아, where the row shows no chip. */
export type SupporterTier = GlobalTitleKey | null;

export type RankedSupporter = {
  rank: number;
  supporterId: string;
  nickname: string;
  avatarUrl: string;
  /** Aggregated donation amount in KRW for the period, as computed by the server. */
  donationAmountKrw: number;
  tier: SupporterTier;
};

export type SupporterRanking = {
  period: RankingPeriod;
  /** Ranked 1..shown. */
  supporters: RankedSupporter[];
  /** All ranked supporters for the period (for "더 보기 (shown/total)"). */
  total: number;
};

export type LiveRanking = { window: LiveWindow; supporters: RankedSupporter[] };

/** One donation as the ranking aggregation reads it. `hideProfile`: sent with 프로필 숨기기 (shown as 익명). */
export type RankingDonation = { supporterId: string; amountKrw: number; hideProfile: boolean };
export type SupporterProfile = Pick<RankedSupporter, "supporterId" | "nickname" | "avatarUrl" | "tier">;

/**
 * Totals per supporter, highest first (ties keep the input order). A donation sent with 프로필 숨기기 went out as 익명,
 * so it never counts toward a named row — 2026-10-08 결정 "명예의 전당·랭킹에서 익명 제외", the channel monthly ranking's
 * rule; a supporter whose donations were all hidden is not ranked. The backend aggregates the same way.
 */
export function rankSupporters(donations: readonly RankingDonation[], profiles: ReadonlyMap<string, SupporterProfile>): RankedSupporter[] {
  const totals = new Map<string, number>();
  for (const d of donations) {
    if (d.hideProfile || !profiles.has(d.supporterId)) continue;
    totals.set(d.supporterId, (totals.get(d.supporterId) ?? 0) + d.amountKrw);
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([supporterId, donationAmountKrw], i) => ({ ...profiles.get(supporterId)!, rank: i + 1, donationAmountKrw }));
}

export async function getSupporterRanking(period: RankingPeriod, show: number = LEADERBOARD_STEP): Promise<SupporterRanking> {
  if (!USE_MOCK) throw new Error("Supporter ranking API is not connected yet.");
  await mockDelay(300);
  const scaled = MOCK_DONATIONS.map((d) => ({ ...d, amountKrw: Math.round((d.amountKrw * PERIOD_SCALE[period]) / 1000) * 1000 }));
  const all = rankSupporters(scaled, MOCK_PROFILES);
  const count = Math.min(Math.max(LEADERBOARD_STEP, Math.floor(show) || LEADERBOARD_STEP), all.length);
  return { period, supporters: all.slice(0, count), total: all.length };
}

/** 실시간 랭킹: donations in the recent window (mock: a reshuffled slice of the field, small amounts). */
export async function getLiveSupporterRanking(window: LiveWindow): Promise<LiveRanking> {
  if (!USE_MOCK) throw new Error("Supporter ranking API is not connected yet.");
  await mockDelay(200);
  const scale = LIVE_SCALE[window];
  const rotated = [...MOCK_FIELD.slice(LIVE_OFFSET[window]), ...MOCK_FIELD.slice(0, LIVE_OFFSET[window])].slice(0, 10).map((s) => s.supporterId);
  const recent = MOCK_DONATIONS.filter((d) => rotated.includes(d.supporterId)).map((d) => ({
    ...d,
    amountKrw: Math.round((d.amountKrw * scale * (1 - rotated.indexOf(d.supporterId) * 0.04)) / 1000) * 1000
  }));
  return { window, supporters: rankSupporters(recent, MOCK_PROFILES) };
}

// Mock aggregation factors (the backend computes real period and window totals).
const PERIOD_SCALE: Record<RankingPeriod, number> = { all: 3.4, month: 1, week: 0.27 };
const LIVE_SCALE: Record<LiveWindow, number> = { "30m": 0.006, "1h": 0.011, "3h": 0.03, "6h": 0.055 };
const LIVE_OFFSET: Record<LiveWindow, number> = { "30m": 3, "1h": 1, "3h": 5, "6h": 0 };

// ── Mock data: copy and images from Figma 3:637 (its DIAMOND · GOLD · SILVER · BRONZE chips became 누적 등급) ──

const A = (n: number) => `/mock/hall-of-fame/supporter-${n}.png`;

const MOCK_TOP_10: RankedSupporter[] = [
  { rank: 1, supporterId: "s1", nickname: "다이아몬드킹", avatarUrl: A(1), donationAmountKrw: 12_450_000, tier: "BLACK_3" },
  { rank: 2, supporterId: "s2", nickname: "별빛후원러", avatarUrl: A(2), donationAmountKrw: 8_230_000, tier: "BLACK_1" },
  { rank: 3, supporterId: "s3", nickname: "응원의신", avatarUrl: A(3), donationAmountKrw: 6_890_000, tier: "RAINBOW_DIAMOND" },
  { rank: 4, supporterId: "s4", nickname: "스트림가디언", avatarUrl: A(4), donationAmountKrw: 4_520_000, tier: "PURPLE_DIAMOND" },
  { rank: 5, supporterId: "s5", nickname: "황금열쇠", avatarUrl: A(5), donationAmountKrw: 3_980_000, tier: "PURPLE_DIAMOND" },
  { rank: 6, supporterId: "s6", nickname: "K예능수호자", avatarUrl: A(6), donationAmountKrw: 3_120_000, tier: "RED_DIAMOND" },
  { rank: 7, supporterId: "s7", nickname: "플레이버스터", avatarUrl: A(7), donationAmountKrw: 2_850_000, tier: "RED_DIAMOND" },
  { rank: 8, supporterId: "s8", nickname: "참된팬클럽", avatarUrl: A(8), donationAmountKrw: 2_100_000, tier: "GREEN_DIAMOND" },
  { rank: 9, supporterId: "s9", nickname: "즐거운소리", avatarUrl: A(9), donationAmountKrw: 1_950_000, tier: "GREEN_DIAMOND" },
  { rank: 10, supporterId: "s10", nickname: "도전하는별", avatarUrl: A(10), donationAmountKrw: 1_620_000, tier: "BLUE_DIAMOND" }
];

/** Figma top 10 plus generated ranks 11–45 so paging and 실시간 windows have data. */
const MOCK_FIELD: RankedSupporter[] = [
  ...MOCK_TOP_10,
  ...Array.from({ length: 35 }, (_, i): RankedSupporter => {
    const rank = i + 11;
    return { rank, supporterId: `s${rank}`, nickname: `서포터${String(rank).padStart(2, "0")}`, avatarUrl: A((rank % 10) + 1), donationAmountKrw: Math.round(1_500_000 * Math.pow(0.93, i)), tier: rank <= 20 ? "DIAMOND" : null };
  })
];

const MOCK_PROFILES: ReadonlyMap<string, SupporterProfile> = new Map(
  MOCK_FIELD.map(({ supporterId, nickname, avatarUrl, tier }) => [supporterId, { supporterId, nickname, avatarUrl, tier }])
);

/** The field's named donations, plus a few sent as 익명 that the ranking must leave out. */
const MOCK_DONATIONS: RankingDonation[] = [
  ...MOCK_FIELD.map((s) => ({ supporterId: s.supporterId, amountKrw: s.donationAmountKrw, hideProfile: false })),
  { supporterId: "s9", amountKrw: 20_000_000, hideProfile: true },
  { supporterId: "s30", amountKrw: 5_000_000, hideProfile: true }
];
