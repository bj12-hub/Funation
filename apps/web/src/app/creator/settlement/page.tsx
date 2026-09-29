import type { Metadata } from "next";
import { SettlementHomeScreen } from "@/features/creatorStudio/settlement/SettlementHomeScreen";

// Figma: settlement-management 429:4 (정산설정 home)
export const metadata: Metadata = { title: "정산설정 | Funation 크리에이터" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <SettlementHomeScreen currentStep={0} />;
}
