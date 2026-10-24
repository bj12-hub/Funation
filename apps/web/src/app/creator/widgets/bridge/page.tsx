import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BridgeScreen } from "@/features/creatorStudio/widgets/BridgeScreen";
import { getBridgeView } from "@/services/creator/bridge";

// Code-first (no Figma frame): 외부 프로그램 연동 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "외부 프로그램 연동 | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getBridgeView();
  if (!view) redirect("/login?role=creator&next=/creator/widgets/bridge");
  return <BridgeScreen view={view} />;
}
