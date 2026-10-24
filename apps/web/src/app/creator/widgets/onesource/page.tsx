import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OverlayLayoutScreen } from "@/features/creatorStudio/widgets/OverlayLayoutScreen";
import { getOverlayLayoutView } from "@/services/creator/overlayLayout";

// Code-first (no Figma frame): 원소스 오버레이 배치 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "원소스 오버레이 | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getOverlayLayoutView();
  if (!view) redirect("/login?role=creator&next=/creator/widgets/onesource");
  return <OverlayLayoutScreen view={view} />;
}
