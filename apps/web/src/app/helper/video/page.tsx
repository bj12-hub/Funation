import type { Metadata } from "next";
import { VideoScreen } from "@/features/creatorStudio/widgets/media/VideoScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getOverlayKey } from "@/services/creator/broadcastTools";
import { getVideoQueue } from "@/services/creator/media";
import { getT } from "@/lib/i18n/server";

// Code-first (no Figma frame): 영상 · 음성 후원, on the helper domain — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("helperNav.video") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, key, switches] = await Promise.all([getVideoQueue(), getOverlayKey(), getOverlaySwitches()]);
  if (!view || !key || !switches) return null;
  return <VideoScreen view={view} overlayPath={`/overlay/video/${key}`} switches={switches} />;
}
