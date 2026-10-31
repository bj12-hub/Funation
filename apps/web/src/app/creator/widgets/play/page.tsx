import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarbleScreen } from "@/features/creatorStudio/play/MarbleScreen";
import { getT } from "@/lib/i18n/server";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getMarbleView } from "@/services/play/marble";

// Code-first (no Figma frame): 시청자 참여 게임 › 마블 룰렛 (로얄 럼블: ./rumble) — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("studioPlay.meta") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, switches] = await Promise.all([getMarbleView(), getOverlaySwitches()]);
  if (!view || !switches) redirect("/login?role=creator&next=/creator/widgets/play");
  return <MarbleScreen view={view} switches={switches} />;
}
