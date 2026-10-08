import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RevenueScreen } from "@/features/creatorStudio/revenue/RevenueScreen";
import { getRevenueOverview } from "@/services/creator/creatorStudio";

// Code-first (no Figma frame): 수익 현황, structure from funnation 수익 대시보드 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "수익 현황 | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await getRevenueOverview();
  if (!data) redirect("/login?role=creator&next=/creator/revenue");
  return <RevenueScreen data={data} />;
}
