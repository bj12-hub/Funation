import type { Metadata } from "next";
import { EffectsScreen } from "@/features/creatorStudio/widgets/EffectsScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getOverlayKey } from "@/services/creator/broadcastTools";
import { getEffectSettings } from "@/services/creator/effects";

// Code-first (no Figma frame): 이모지 리액션 · 레이어 효과, on the helper domain — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "이펙트" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [settings, key, switches] = await Promise.all([getEffectSettings(), getOverlayKey(), getOverlaySwitches()]);
  if (!settings || !key || !switches) return null;
  return <EffectsScreen initial={settings} overlayPath={`/overlay/effects/${key}`} switches={switches} />;
}
