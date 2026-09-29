import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BroadcastScreen } from "@/features/creatorStudio/crew/BroadcastScreen";
import { getBroadcastView } from "@/services/crew/crewBroadcast";

// Code-first (no Figma frame): 크루 방송 운영 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "크루 방송 운영 | Funation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getBroadcastView();
  if (!view) redirect("/login?role=creator&next=/creator/crew/broadcast");
  return <BroadcastScreen view={view} />;
}
