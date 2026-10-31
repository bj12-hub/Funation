import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RemoteScreen } from "@/features/creatorStudio/remote/RemoteScreen";
import { getRemoteView } from "@/services/creator/alertRemote";
import { getOverlayKey, getToolsView } from "@/services/creator/broadcastTools";
import { getQuestRemote } from "@/services/creator/questRemote";
import { getVoteRemote } from "@/services/creator/voteRemote";
import { getRouletteRemote } from "@/services/creator/rouletteRemote";
import { getGachaRemote } from "@/services/creator/gachaRemote";
import { getWallpaperRemote } from "@/services/creator/wallpaperRemote";
import { getT } from "@/lib/i18n/server";

// Code-first (no Figma frame): 리모컨 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("studioRemote.metaStudio") };
}
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
  if (!view || !key || !tools || !quest || !vote || !roulette || !gacha || !wallpaper) redirect("/login?role=creator&next=/creator/remote");
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
