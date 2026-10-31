import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UnifiedChatScreen } from "@/features/broadcast/UnifiedChatScreen";
import { getUnifiedChat } from "@/services/broadcast/unifiedChat";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getT } from "@/lib/i18n/server";

// Code-first (no Figma frame): 통합 채팅 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("unifiedChat.metaStudio") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, switches] = await Promise.all([getUnifiedChat(), getOverlaySwitches()]);
  if (!view || !switches) redirect("/login?role=creator&next=/creator/chat");
  return <UnifiedChatScreen initial={view} switches={switches} />;
}
