import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CustomOverlayScreen } from "@/features/creatorStudio/widgets/CustomOverlayScreen";
import { getCustomOverlayView } from "@/services/creator/customOverlay";

// Code-first (no Figma frame): 커스텀 오버레이 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "커스텀 오버레이 | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getCustomOverlayView();
  if (!view) redirect("/login?role=creator&next=/creator/widgets/custom");
  return <CustomOverlayScreen view={view} />;
}
