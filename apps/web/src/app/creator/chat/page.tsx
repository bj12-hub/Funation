import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UnifiedChatScreen } from "@/features/broadcast/UnifiedChatScreen";
import { getUnifiedChat } from "@/services/broadcast/unifiedChat";

// Code-first (no Figma frame): 통합 채팅 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "통합 채팅 | Somnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getUnifiedChat();
  if (!view) redirect("/login?role=creator&next=/creator/chat");
  return <UnifiedChatScreen initial={view} />;
}
