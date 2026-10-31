import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CrewScreen } from "@/features/creatorStudio/crew/CrewScreen";
import { getT } from "@/lib/i18n/server";
import { getCrewStudio } from "@/services/crew/crew";

// Code-first (no Figma frame): 크루 관리 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("crewOps.metaMembers") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getCrewStudio();
  if (!view) redirect("/login?role=creator&next=/creator/crew");
  return <CrewScreen view={view} />;
}
