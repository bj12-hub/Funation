import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RumbleLiveScreen } from "@/features/creatorStudio/play/RumbleLiveScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getLiveView } from "@/services/play/rumbleLive";

// Code-first (no Figma frame): 시청자 참여 게임 › 로얄 럼블 (조작형) — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "로얄 럼블 (조작형) | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, switches] = await Promise.all([getLiveView(), getOverlaySwitches()]);
  if (!view || !switches) redirect("/login?role=creator&next=/creator/widgets/play/live");
  return <RumbleLiveScreen view={view} switches={switches} />;
}
