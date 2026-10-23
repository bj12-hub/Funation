import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GamesScreen } from "@/features/creatorStudio/crew/GamesScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getGamesView } from "@/services/crew/crewGames";

// Code-first (no Figma frame): 크루 점수 게임 (스핀머신 …) — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "점수 게임 | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, switches] = await Promise.all([getGamesView(), getOverlaySwitches()]);
  if (!view || !switches) redirect("/login?role=creator&next=/creator/crew/games");
  return <GamesScreen view={view} switches={switches} />;
}
