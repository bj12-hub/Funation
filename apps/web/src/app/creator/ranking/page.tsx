import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreatorRankingScreen } from "@/features/creatorStudio/ranking/CreatorRankingScreen";
import { getCreatorRanking, parseRankingPeriod, parseRankingType } from "@/services/creator/creatorRanking";

// Figma: creator ranking 405:4 (퀘스트); 럭키박스 · 플레이 tabs removed (2026-10-04 결정)
export const metadata: Metadata = { title: "크리에이터 랭킹 | Ssumnation" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const ranking = await getCreatorRanking({
    type: parseRankingType(one(raw.type)),
    period: parseRankingPeriod(one(raw.period)),
    query: one(raw.q),
    page: Number(one(raw.page) ?? 1)
  });
  if (!ranking) redirect("/login?role=creator&next=/creator/ranking");
  return <CreatorRankingScreen ranking={ranking} />;
}
