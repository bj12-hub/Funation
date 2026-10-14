import type { Metadata } from "next";
import { UnifiedChatScreen } from "@/features/broadcast/UnifiedChatScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getUnifiedChat } from "@/services/broadcast/unifiedChat";

// Code-first (no Figma frame): 통합 채팅, on the helper domain — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "채팅창" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, switches] = await Promise.all([getUnifiedChat(), getOverlaySwitches()]);
  if (!view || !switches) return null;
  return <UnifiedChatScreen initial={view} switches={switches} />;
}
