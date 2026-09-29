import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UpdatesScreen } from "@/features/creatorStudio/updates/UpdatesScreen";
import { getUpdates } from "@/services/creator/updates";

// Code-first (no Figma frame): 업데이트 소식 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "업데이트 소식 | Somnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getUpdates();
  if (!view) redirect("/login?role=creator&next=/creator/updates");
  return <UpdatesScreen view={view} />;
}
