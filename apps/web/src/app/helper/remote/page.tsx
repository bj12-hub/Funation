import type { Metadata } from "next";
import { RemoteScreen } from "@/features/creatorStudio/remote/RemoteScreen";
import { getRemoteView } from "@/services/creator/alertRemote";
import { getOverlayKey, getToolsView } from "@/services/creator/broadcastTools";
import { getGachaRemote } from "@/services/creator/gachaRemote";
import { getQuestRemote } from "@/services/creator/questRemote";
import { getRouletteRemote } from "@/services/creator/rouletteRemote";
import { getVoteRemote } from "@/services/creator/voteRemote";
import { getWallpaperRemote } from "@/services/creator/wallpaperRemote";

// Code-first (no Figma frame): 리모컨, on the helper domain — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "리모컨" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, key, tools, quest, vote, roulette, gacha, wallpaper] = await Promise.all([
    getRemoteView(),
    getOverlayKey(),
    getToolsView(),
    getQuestRemote(),
    getVoteRemote(),
    getRouletteRemote(),
    getGachaRemote(),
    getWallpaperRemote()
  ]);
  if (!view || !key || !tools || !quest || !vote || !roulette || !gacha || !wallpaper) return null;
  return (
    <RemoteScreen
      view={view}
      overlayPath={`/overlay/alert/${key}`}
      tools={{ timer: tools.states.timer, credits: tools.states.credits, bingo: tools.states.bingo }}
      quest={quest}
      vote={vote}
      roulette={roulette}
      gacha={gacha}
      wallpaper={wallpaper}
    />
  );
}
