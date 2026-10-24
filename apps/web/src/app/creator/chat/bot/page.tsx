import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChatBotScreen } from "@/features/broadcast/ChatBotScreen";
import { getChatBotView } from "@/services/broadcast/chatBot";

// Code-first (no Figma frame): 채팅봇 명령어 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "채팅봇 명령어 | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getChatBotView();
  if (!view) redirect("/login?role=creator&next=/creator/chat/bot");
  return <ChatBotScreen view={view} />;
}
