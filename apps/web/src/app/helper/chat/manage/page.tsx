import type { Metadata } from "next";
import { UnifiedChatScreen } from "@/features/broadcast/UnifiedChatScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getUnifiedChat } from "@/services/broadcast/unifiedChat";
import { getT } from "@/lib/i18n/server";

// Code-first (no Figma frame): 통합 채팅 (채팅 보기 · 보내기 · 관리), on the helper domain at /chat/manage — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("helperNav.chatManage") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, switches] = await Promise.all([getUnifiedChat(), getOverlaySwitches()]);
  if (!view || !switches) return null;
  return <UnifiedChatScreen initial={view} switches={switches} />;
}
