import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RumbleScreen } from "@/features/creatorStudio/play/RumbleScreen";
import { getT } from "@/lib/i18n/server";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getRumbleView } from "@/services/play/rumble";

// Code-first (no Figma frame): 시청자 참여 게임 › 로얄 럼블 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("studioPlay.metaRumble") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, switches] = await Promise.all([getRumbleView(), getOverlaySwitches()]);
  if (!view || !switches) redirect("/login?role=creator&next=/creator/widgets/play/rumble");
  return <RumbleScreen view={view} switches={switches} />;
}
