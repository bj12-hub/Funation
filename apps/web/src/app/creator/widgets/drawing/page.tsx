import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DrawingScreen } from "@/features/creatorStudio/widgets/media/DrawingScreen";
import { getT } from "@/lib/i18n/server";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getOverlayKey } from "@/services/creator/broadcastTools";
import { getDrawings } from "@/services/creator/media";

// Code-first (no Figma frame): 그림후원 전시 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("studioToolsMedia.metaDrawing") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, key, switches] = await Promise.all([getDrawings(), getOverlayKey(), getOverlaySwitches()]);
  if (!view || !key || !switches) redirect("/login?role=creator&next=/creator/widgets/drawing");
  return <DrawingScreen view={view} overlayPath={`/overlay/drawing/${key}`} switches={switches} />;
}
