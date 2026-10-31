import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GamesScreen } from "@/features/creatorStudio/crew/GamesScreen";
import { getT } from "@/lib/i18n/server";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getGamesView } from "@/services/crew/crewGames";

// Code-first (no Figma frame): 크루 점수 게임 (스핀머신 …) — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("crewGame.meta") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, switches] = await Promise.all([getGamesView(), getOverlaySwitches()]);
  if (!view || !switches) redirect("/login?role=creator&next=/creator/crew/games");
  return <GamesScreen view={view} switches={switches} />;
}
