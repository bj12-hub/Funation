import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FlextvRemoteScreen } from "@/features/creatorStudio/remote/FlextvRemoteScreen";
import { RemoteScreen } from "@/features/creatorStudio/remote/RemoteScreen";
import { FLEXTV_SSUMNATION_API, FLEXTV_STUDIO } from "@/lib/flextv/mode";
import { getFlextvRemote } from "@/services/creator/flextvRemote";
import { REMOTE_WINDOW_PATH } from "@/features/creatorStudio/remote/remoteWindow";
import { creatorOnlyRedirect } from "@/lib/creatorGate";
import { getRemoteView } from "@/services/creator/alertRemote";
import { getOverlayKey, getToolsView } from "@/services/creator/broadcastTools";
import { getGachaRemote } from "@/services/creator/gachaRemote";
import { getQuestRemote } from "@/services/creator/questRemote";
import { getRouletteRemote } from "@/services/creator/rouletteRemote";
import { getVoteRemote } from "@/services/creator/voteRemote";
import { getWallpaperRemote } from "@/services/creator/wallpaperRemote";
import studio from "@/features/creatorStudio/studio.module.css";
import { getT } from "@/lib/i18n/server";

// Code-first (no Figma frame): 리모컨 on its own — the 도우미's "리모컨 열기" window (1000 × 800), an OBS custom browser
// dock or a phone. Same controls and server checks as /creator/remote; served on the site and the 도우미 domain.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("studioRemote.metaWindow"), robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  if (FLEXTV_STUDIO) {
    // With FLEXTV (phase 6): the 퀘스트 · 룰렛 · 뽑기 on FLEXTV's endpoints, as /creator/remote.
    if (!FLEXTV_SSUMNATION_API) notFound();
    const flextv = await getFlextvRemote();
    if (!flextv) redirect(await creatorOnlyRedirect(REMOTE_WINDOW_PATH));
    return (
      <div data-theme="dark" className={studio.themeScope}>
        <FlextvRemoteScreen {...flextv} variant="window" />
      </div>
    );
  }
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
  // Signed out → sign-in; signed in without a channel → 채널 만들기 (sign-in would send them straight back here).
  if (!view || !key || !tools || !quest || !vote || !roulette || !gacha || !wallpaper) redirect(await creatorOnlyRedirect(REMOTE_WINDOW_PATH));
  // The remote's styles are dark-only, like the studio.
  return (
    <div data-theme="dark" className={studio.themeScope}>
      <RemoteScreen
        view={view}
        overlayPath={`/overlay/alert/${key}`}
        tools={{ timer: tools.states.timer, credits: tools.states.credits, bingo: tools.states.bingo }}
        quest={quest}
        vote={vote}
        roulette={roulette}
        gacha={gacha}
        wallpaper={wallpaper}
        variant="window"
      />
    </div>
  );
}
