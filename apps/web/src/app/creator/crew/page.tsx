import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CrewScreen } from "@/features/creatorStudio/crew/CrewScreen";
import { getCrewStudio } from "@/services/crew/crew";

// Code-first (no Figma frame): 크루 관리 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "크루 관리 | Funation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getCrewStudio();
  if (!view) redirect("/login?role=creator&next=/creator/crew");
  return <CrewScreen view={view} />;
}
