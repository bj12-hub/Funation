import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EffectsScreen } from "@/features/creatorStudio/widgets/EffectsScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { listAssets } from "@/services/creator/assets";
import { getOverlayKey } from "@/services/creator/broadcastTools";
import { getEffectSettings } from "@/services/creator/effects";

// Code-first (no Figma frame): 이모지 리액션 · 레이어 효과 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "이펙트 · 효과 | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [settings, key, switches, videos] = await Promise.all([getEffectSettings(), getOverlayKey(), getOverlaySwitches(), listAssets("VIDEO")]);
  if (!settings || !key || !switches || !videos) redirect("/login?role=creator&next=/creator/widgets/effects");
  return <EffectsScreen initial={settings} videos={videos} overlayPath={`/overlay/effects/${key}`} switches={switches} />;
}
