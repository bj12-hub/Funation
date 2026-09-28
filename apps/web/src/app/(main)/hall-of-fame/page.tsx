import type { Metadata } from "next";
import { HallOfFameScreen } from "@/features/hallOfFame";
import { DEFAULT_RANKING_PERIOD, RANKING_PERIOD_LABEL, getSupporterRanking, type RankingPeriod } from "@/services/hallOfFame/supporterRanking";

// Figma: funation-hall-of-fame 3:637
export const metadata: Metadata = { title: "명예의 전당 | Funation" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string | string[] }> }) {
  const { period } = await searchParams;
  const selected = typeof period === "string" && period in RANKING_PERIOD_LABEL ? (period as RankingPeriod) : DEFAULT_RANKING_PERIOD;
  const ranking = await getSupporterRanking(selected);
  return <HallOfFameScreen ranking={ranking} />;
}
