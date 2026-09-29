import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreatorDashboardScreen } from "@/features/creatorStudio/CreatorDashboardScreen";
import { getCreatorDashboard, getCreatorProfile, parseStatsPeriod } from "@/services/creator/creatorStudio";

// Figma: creator-dashboard 245:14
export const metadata: Metadata = { title: "크리에이터 대시보드 | Funation" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const period = parseStatsPeriod({ period: one(raw.period), from: one(raw.from), to: one(raw.to) });
  const [profile, dashboard] = await Promise.all([getCreatorProfile(), getCreatorDashboard(period)]);
  if (!profile || !dashboard) redirect("/login?role=creator&next=/creator");
  return <CreatorDashboardScreen profile={profile} dashboard={dashboard} />;
}
