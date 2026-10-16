import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UnifiedChatScreen } from "@/features/broadcast/UnifiedChatScreen";
import { creatorOnlyRedirect } from "@/lib/creatorGate";
import { CHAT_WINDOW_PATH } from "@/services/broadcast/chatTypes";
import { getUnifiedChat } from "@/services/broadcast/unifiedChat";

// Code-first (no Figma frame): 통합 채팅 as its own web page — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "통합 채팅 | Ssumnation", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  // Creator session only (the same server checks as the studio chat; moderation actions re-check it).
  const view = await getUnifiedChat();
  // Signed out → sign-in; signed in without a channel → 채널 만들기 (sign-in would send them straight back here).
  if (!view) redirect(await creatorOnlyRedirect(CHAT_WINDOW_PATH));
  return <UnifiedChatScreen initial={view} variant="window" />;
}
