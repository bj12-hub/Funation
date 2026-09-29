import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DrawingScreen } from "@/features/creatorStudio/widgets/media/DrawingScreen";
import { getOverlayKey } from "@/services/creator/broadcastTools";
import { getDrawings } from "@/services/creator/media";

// Code-first (no Figma frame): 그림후원 전시 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "그림후원 | Somnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, key] = await Promise.all([getDrawings(), getOverlayKey()]);
  if (!view || !key) redirect("/login?role=creator&next=/creator/widgets/drawing");
  return <DrawingScreen view={view} overlayPath={`/overlay/drawing/${key}`} />;
}
