import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RevenueScreen } from "@/features/creatorStudio/revenue/RevenueScreen";
import { getT } from "@/lib/i18n/server";
import { getRevenueOverview } from "@/services/creator/creatorStudio";

// Code-first (no Figma frame): 수익 현황, structure from funnation 수익 대시보드 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("studioRevenue.meta") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await getRevenueOverview();
  if (!data) redirect("/login?role=creator&next=/creator/revenue");
  return <RevenueScreen data={data} />;
}
