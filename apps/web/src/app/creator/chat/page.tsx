import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UnifiedChatScreen } from "@/features/broadcast/UnifiedChatScreen";
import { FlextvChatSettingsScreen } from "@/features/creatorStudio/chat/FlextvChatSettingsScreen";
import { FLEXTV_SITE } from "@/lib/flextv/mode";
import { getUnifiedChat } from "@/services/broadcast/unifiedChat";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getFlextvChatSettings } from "@/services/creator/flextvChatSettings";
import { getT } from "@/lib/i18n/server";

// Code-first (no Figma frame): 통합 채팅 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t(FLEXTV_SITE ? "unifiedChat.metaFlextv" : "unifiedChat.metaStudio") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  // With FLEXTV (phase 9): the channel's chat settings on FLEXTV.
  if (FLEXTV_SITE) {
    const view = await getFlextvChatSettings();
    if (!view) redirect("/login?role=creator&next=/creator/chat");
    return <FlextvChatSettingsScreen view={view} />;
  }
  const [view, switches] = await Promise.all([getUnifiedChat(), getOverlaySwitches()]);
  if (!view || !switches) redirect("/login?role=creator&next=/creator/chat");
  return <UnifiedChatScreen initial={view} switches={switches} />;
}
