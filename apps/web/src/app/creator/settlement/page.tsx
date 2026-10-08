import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettlementHomeScreen } from "@/features/creatorStudio/settlement/SettlementHomeScreen";
import { getSettlementOverview } from "@/services/creator/settlement";

// Figma: settlement-management 429:4 · 정산 자료 등록 필요 433:4 · 이미 등록 462:2 · 본인인증 필요 (code-first)
export const metadata: Metadata = { title: "정산설정 | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ registered?: string; gate?: string }> }) {
  const [overview, { registered, gate }] = await Promise.all([getSettlementOverview(), searchParams]);
  if (!overview) redirect("/login?role=creator&next=/creator/settlement");
  // `gate=identity` comes from the apply page; it only opens the notice while 본인인증 is still missing.
  const identityGate = gate === "identity" && overview.registered && !overview.checklist.identityVerified;
  return (
    <SettlementHomeScreen
      registered={overview.registered}
      justRegistered={overview.registered && registered === "1"}
      checklist={overview.checklist}
      identityGate={identityGate}
    />
  );
}
