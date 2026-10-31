import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BroadcastToolsScreen } from "@/features/creatorStudio/widgets/BroadcastToolsScreen";
import { getT } from "@/lib/i18n/server";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getOverlayKey, getToolsView } from "@/services/creator/broadcastTools";

// Code-first (no Figma frame): 방송 도구 (자막 · 전광판 · 타이머 · 엔딩 크레딧) — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("studioTools.meta") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, key, switches] = await Promise.all([getToolsView(), getOverlayKey(), getOverlaySwitches()]);
  if (!view || !key || !switches) redirect("/login?role=creator&next=/creator/widgets/tools");
  return <BroadcastToolsScreen view={view} overlayKey={key} switches={switches} />;
}
