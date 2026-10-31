import type { Metadata } from "next";
import { CrewScreen } from "@/features/creatorStudio/crew/CrewScreen";
import { getCrewStudio } from "@/services/crew/crew";
import { getT } from "@/lib/i18n/server";

// Code-first (no Figma frame): 크루 관리, on the helper domain — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("helperNav.crew") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getCrewStudio();
  if (!view) return null;
  return <CrewScreen view={view} />;
}
