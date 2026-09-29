import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OverlayUrlsScreen } from "@/features/creatorStudio/widgets/OverlayUrlsScreen";
import { getOverlayKey } from "@/services/creator/broadcastTools";

// Code-first (no Figma frame): 오버레이 주소 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "오버레이 주소 | Funation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const key = await getOverlayKey();
  if (!key) redirect("/login?role=creator&next=/creator/widgets/overlays");
  return <OverlayUrlsScreen overlayKey={key} />;
}
