import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AiBannerScreen } from "@/features/creatorStudio/widgets/library/AiBannerScreen";
import { getCreatorSession } from "@/lib/session";

// Code-first (no Figma frame): AI 배너 (mock provider until an AI image service is chosen) — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "AI 배너 | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await getCreatorSession())) redirect("/login?role=creator&next=/creator/widgets/banner/ai");
  return <AiBannerScreen />;
}
