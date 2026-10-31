import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UpdatesScreen } from "@/features/creatorStudio/updates/UpdatesScreen";
import { getT } from "@/lib/i18n/server";
import { getUpdates } from "@/services/creator/updates";

// Code-first (no Figma frame): 업데이트 소식 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("studioUpdates.meta") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getUpdates();
  if (!view) redirect("/login?role=creator&next=/creator/updates");
  return <UpdatesScreen view={view} />;
}
