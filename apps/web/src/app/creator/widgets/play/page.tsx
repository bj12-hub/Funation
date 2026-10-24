import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarbleScreen } from "@/features/creatorStudio/play/MarbleScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getMarbleView } from "@/services/play/marble";

// Code-first (no Figma frame): 시청자 참여 게임 › 마블 룰렛 (로얄 럼블: ./rumble) — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "시청자 참여 게임 | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, switches] = await Promise.all([getMarbleView(), getOverlaySwitches()]);
  if (!view || !switches) redirect("/login?role=creator&next=/creator/widgets/play");
  return <MarbleScreen view={view} switches={switches} />;
}
