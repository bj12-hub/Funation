import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RemoteScreen } from "@/features/creatorStudio/remote/RemoteScreen";
import { REMOTE_WINDOW_PATH } from "@/features/creatorStudio/remote/remoteWindow";
import { getRemoteView } from "@/services/creator/alertRemote";
import { getOverlayKey, getToolsView } from "@/services/creator/broadcastTools";
import { getGachaRemote } from "@/services/creator/gachaRemote";
import { getRouletteRemote } from "@/services/creator/rouletteRemote";
import { getVoteRemote } from "@/services/creator/voteRemote";
import { getWallpaperRemote } from "@/services/creator/wallpaperRemote";
import studio from "@/features/creatorStudio/studio.module.css";

// Code-first (no Figma frame): 리모컨 on its own — the 도우미's "리모컨 열기" window (1000 × 800), an OBS custom browser
// dock or a phone. Same controls and server checks as /creator/remote; served on the site and the 도우미 domain.
export const metadata: Metadata = { title: "리모컨 | Ssumnation", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, key, tools, vote, roulette, gacha, wallpaper] = await Promise.all([
    getRemoteView(),
    getOverlayKey(),
    getToolsView(),
    getVoteRemote(),
    getRouletteRemote(),
    getGachaRemote(),
    getWallpaperRemote()
  ]);
  if (!view || !key || !tools || !vote || !roulette || !gacha || !wallpaper) redirect(`/login?role=creator&next=${REMOTE_WINDOW_PATH}`);
  // The remote's styles are dark-only, like the studio.
  return (
    <div data-theme="dark" className={studio.themeScope}>
      <RemoteScreen
        view={view}
        overlayPath={`/overlay/alert/${key}`}
        tools={{ timer: tools.states.timer, credits: tools.states.credits, bingo: tools.states.bingo }}
        vote={vote}
        roulette={roulette}
        gacha={gacha}
        wallpaper={wallpaper}
        variant="window"
      />
    </div>
  );
}
