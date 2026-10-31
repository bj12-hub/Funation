import type { Metadata } from "next";
import { EffectsScreen } from "@/features/creatorStudio/widgets/EffectsScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { listAssets } from "@/services/creator/assets";
import { getOverlayKey } from "@/services/creator/broadcastTools";
import { getEffectSettings } from "@/services/creator/effects";
import { getT } from "@/lib/i18n/server";

// Code-first (no Figma frame): 이모지 리액션 · 레이어 효과, on the helper domain — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("helperNav.effects") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [settings, key, switches, videos] = await Promise.all([getEffectSettings(), getOverlayKey(), getOverlaySwitches(), listAssets("VIDEO")]);
  if (!settings || !key || !switches || !videos) return null;
  return <EffectsScreen initial={settings} videos={videos} overlayPath={`/overlay/effects/${key}`} switches={switches} />;
}
