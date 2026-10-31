import type { Metadata } from "next";
import { GamesScreen } from "@/features/creatorStudio/crew/GamesScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getGamesView } from "@/services/crew/crewGames";
import { getT } from "@/lib/i18n/server";

// Code-first (no Figma frame): 크루 점수 게임, on the helper domain — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("helperNav.crewGames") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, switches] = await Promise.all([getGamesView(), getOverlaySwitches()]);
  if (!view || !switches) return null;
  return <GamesScreen view={view} switches={switches} />;
}
