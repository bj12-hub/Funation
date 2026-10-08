/**
 * 내 후원 랭킹 — code-first, no Figma frame. Reference: docs/research/funnation-reference.md §1.
 * Other supporters are mock sample data. Donations sent as 익명 (프로필 숨기기) are not counted (2026-10-08 결정
 * "명예의 전당·랭킹에서 익명 제외"). Still TBD: refunds, ties, season resets, and the effect of 마이페이지 "랭킹 노출"
 * on public boards.
 */

export const RANKING_PERIODS = [
  { key: "all", label: "누적" },
  { key: "year", label: "올해" },
  { key: "month", label: "이번 달" }
] as const;
export type RankingPeriod = (typeof RANKING_PERIODS)[number]["key"];
export const isRankingPeriod = (v: unknown): v is RankingPeriod => RANKING_PERIODS.some((p) => p.key === v);

export type BoardRow = { rank: number; name: string; totalFn: number; me: boolean };
export type CreatorStanding = { creatorId: string; creatorName: string; myTotalFn: number; myRank: number; donors: number };

export type MyRankingView = {
  period: RankingPeriod;
  myTotalFn: number;
  myRank: number | null;
  totalDonors: number;
  topPercent: number | null;
  board: BoardRow[];
  creators: CreatorStanding[];
  visible: boolean;
};
