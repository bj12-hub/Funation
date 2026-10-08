import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VideoScreen } from "@/features/creatorStudio/widgets/media/VideoScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getOverlayKey } from "@/services/creator/broadcastTools";
import { getVideoQueue } from "@/services/creator/media";

// Code-first (no Figma frame): 영상 후원 관리 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "영상 후원 | Somnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, key, switches] = await Promise.all([getVideoQueue(), getOverlayKey(), getOverlaySwitches()]);
  if (!view || !key || !switches) redirect("/login?role=creator&next=/creator/widgets/video");
  return <VideoScreen view={view} overlayPath={`/overlay/video/${key}`} switches={switches} />;
}
