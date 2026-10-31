import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChatBotScreen } from "@/features/broadcast/ChatBotScreen";
import { getChatBotView } from "@/services/broadcast/chatBot";
import { getT } from "@/lib/i18n/server";

// Code-first (no Figma frame): 채팅봇 명령어 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("chatBot.meta") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getChatBotView();
  if (!view) redirect("/login?role=creator&next=/creator/chat/bot");
  return <ChatBotScreen view={view} />;
}
