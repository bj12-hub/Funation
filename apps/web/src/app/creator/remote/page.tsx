import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RemoteScreen } from "@/features/creatorStudio/remote/RemoteScreen";
import { getRemoteView } from "@/services/creator/alertRemote";
import { getOverlayKey } from "@/services/creator/broadcastTools";

// Code-first (no Figma frame): 리모컨 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "리모컨 | Funation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, key] = await Promise.all([getRemoteView(), getOverlayKey()]);
  if (!view || !key) redirect("/login?role=creator&next=/creator/remote");
  return <RemoteScreen view={view} overlayPath={`/overlay/alert/${key}`} />;
}
