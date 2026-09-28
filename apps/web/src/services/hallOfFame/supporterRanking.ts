import { USE_MOCK, mockDelay } from "@/lib/mock";

/**
 * Supporter ranking contract.
 * Figma: funation-hall-of-fame 3:637 (route `/hall-of-fame`)
 *
 * Amounts and tiers come from the server's aggregated donation records; the client only displays them.
 * Tier thresholds and the aggregation rules are TBD.
 */

export type RankingPeriod = "all" | "month" | "week" | "day";

/** Tab order and labels from Figma 3:679. */
export const RANKING_PERIOD_LABEL: Record<RankingPeriod, string> = {
  all: "전체",
  month: "이번 달",
  week: "이번 주",
  day: "오늘"
};

/** Figma shows 이번 달 selected. */
export const DEFAULT_RANKING_PERIOD: RankingPeriod = "month";

export type SupporterTier = "DIAMOND" | "GOLD" | "SILVER" | "BRONZE";

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
  /** Ranked 1..N (Figma shows the top 10). */
  supporters: RankedSupporter[];
};

export async function getSupporterRanking(period: RankingPeriod): Promise<SupporterRanking> {
  if (!USE_MOCK) throw new Error("Supporter ranking API is not connected yet.");
  await mockDelay(300);
  // Figma only has the 이번 달 data; every period returns it in the mock.
  return { period, supporters: MOCK_TOP_10 };
}

// ── Mock data: copy and images from Figma 3:637 ───────────────────────────────

const A = (n: number) => `/mock/hall-of-fame/supporter-${n}.png`;

const MOCK_TOP_10: RankedSupporter[] = [
  { rank: 1, supporterId: "s1", nickname: "다이아몬드킹", avatarUrl: A(1), donationAmountKrw: 12_450_000, tier: "DIAMOND" },
  { rank: 2, supporterId: "s2", nickname: "별빛후원러", avatarUrl: A(2), donationAmountKrw: 8_230_000, tier: "DIAMOND" },
  { rank: 3, supporterId: "s3", nickname: "응원의신", avatarUrl: A(3), donationAmountKrw: 6_890_000, tier: "GOLD" },
  { rank: 4, supporterId: "s4", nickname: "스트림가디언", avatarUrl: A(4), donationAmountKrw: 4_520_000, tier: "GOLD" },
  { rank: 5, supporterId: "s5", nickname: "황금열쇠", avatarUrl: A(5), donationAmountKrw: 3_980_000, tier: "GOLD" },
  { rank: 6, supporterId: "s6", nickname: "K예능수호자", avatarUrl: A(6), donationAmountKrw: 3_120_000, tier: "SILVER" },
  { rank: 7, supporterId: "s7", nickname: "플레이버스터", avatarUrl: A(7), donationAmountKrw: 2_850_000, tier: "SILVER" },
  { rank: 8, supporterId: "s8", nickname: "참된팬클럽", avatarUrl: A(8), donationAmountKrw: 2_100_000, tier: "SILVER" },
  { rank: 9, supporterId: "s9", nickname: "즐거운소리", avatarUrl: A(9), donationAmountKrw: 1_950_000, tier: "BRONZE" },
  { rank: 10, supporterId: "s10", nickname: "도전하는별", avatarUrl: A(10), donationAmountKrw: 1_620_000, tier: "BRONZE" }
];
