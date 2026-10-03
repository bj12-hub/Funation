import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UnifiedChatScreen } from "@/features/broadcast/UnifiedChatScreen";
import { CHAT_WINDOW_PATH } from "@/services/broadcast/chatTypes";
import { getUnifiedChat } from "@/services/broadcast/unifiedChat";

// Code-first (no Figma frame): 통합 채팅 as its own web page — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "통합 채팅 | Somnation", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  // Creator session only (the same server checks as the studio chat; moderation actions re-check it).
  const view = await getUnifiedChat();
  if (!view) redirect(`/login?role=creator&next=${CHAT_WINDOW_PATH}`);
  return <UnifiedChatScreen initial={view} variant="window" />;
}
