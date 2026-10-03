import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RemoteScreen } from "@/features/creatorStudio/remote/RemoteScreen";
import { getRemoteView } from "@/services/creator/alertRemote";
import { getOverlayKey, getToolsView } from "@/services/creator/broadcastTools";
import { getVoteRemote } from "@/services/creator/voteRemote";
import { getRouletteRemote } from "@/services/creator/rouletteRemote";

// Code-first (no Figma frame): 리모컨 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "리모컨 | Somnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, key, tools, vote, roulette] = await Promise.all([getRemoteView(), getOverlayKey(), getToolsView(), getVoteRemote(), getRouletteRemote()]);
  if (!view || !key || !tools || !vote || !roulette) redirect("/login?role=creator&next=/creator/remote");
  return <RemoteScreen view={view} overlayPath={`/overlay/alert/${key}`} tools={{ timer: tools.states.timer, credits: tools.states.credits }} vote={vote} roulette={roulette} />;
}
