import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettlementTermsScreen } from "@/features/creatorStudio/settlement/SettlementTermsScreen";
import { getT } from "@/lib/i18n/server";
import { getSettlementOverview } from "@/services/creator/settlement";
import { isMemberType } from "@/services/creator/settlementTypes";

// Figma: 이용동의 429:139 · 443:257 · 433:138 · 437:338 · 대한민국 이외 452:4 · 452:47
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("studioSettlement.metaRegister") };
}
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const [overview, { type }] = await Promise.all([getSettlementOverview(), searchParams]);
  if (!overview) redirect("/login?role=creator&next=/creator/settlement/register");
  // Re-registration starts from 정산 관리 > 정보 변경 (480:2), which clears the current data first.
  if (overview.registered) redirect("/creator/settlement/manage");
  return <SettlementTermsScreen initialType={isMemberType(type) ? type : "INDIVIDUAL"} />;
}
