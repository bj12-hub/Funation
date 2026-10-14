import type { Metadata } from "next";
import { CrewScreen } from "@/features/creatorStudio/crew/CrewScreen";
import { getCrewStudio } from "@/services/crew/crew";

// Code-first (no Figma frame): 크루 관리, on the helper domain — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "크루 관리" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getCrewStudio();
  if (!view) return null;
  return <CrewScreen view={view} />;
}
