import type { Metadata } from "next";
import { DrawingScreen } from "@/features/creatorStudio/widgets/media/DrawingScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getOverlayKey } from "@/services/creator/broadcastTools";
import { getDrawings } from "@/services/creator/media";
import { getT } from "@/lib/i18n/server";

// Code-first (no Figma frame): 그림후원 전시, on the helper domain — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("helperNav.drawing") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, key, switches] = await Promise.all([getDrawings(), getOverlayKey(), getOverlaySwitches()]);
  if (!view || !key || !switches) return null;
  return <DrawingScreen view={view} overlayPath={`/overlay/drawing/${key}`} switches={switches} />;
}
