import type { Metadata } from "next";
import { HallOfFameScreen } from "@/features/hallOfFame";
import {
  DEFAULT_RANKING_PERIOD,
  RANKING_PERIOD_LABEL,
  getLiveSupporterRanking,
  getSupporterRanking,
  parseHofTab,
  parseLiveWindow,
  type RankingPeriod
} from "@/services/hallOfFame/supporterRanking";

// Figma: ssumnation-hall-of-fame 3:637 (hero, podium); tabs follow funnation 명예의 전당.
export const metadata: Metadata = { title: "명예의 전당 | Ssumnation" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const tab = parseHofTab(one(raw.tab));
  const period = one(raw.period);
  const selected = period && Object.hasOwn(RANKING_PERIOD_LABEL, period) ? (period as RankingPeriod) : DEFAULT_RANKING_PERIOD;
  const [ranking, live] = await Promise.all([
    tab === "leaderboard" ? getSupporterRanking(selected, Number(one(raw.show))) : Promise.resolve(null),
    tab === "live" ? getLiveSupporterRanking(parseLiveWindow(one(raw.window))) : Promise.resolve(null)
  ]);
  return <HallOfFameScreen tab={tab} ranking={ranking} live={live} />;
}
