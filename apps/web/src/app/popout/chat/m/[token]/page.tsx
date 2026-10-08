import type { Metadata } from "next";
import { ManagerChatScreen } from "@/features/broadcast/UnifiedChatScreen";
import { getManagerChat } from "@/services/broadcast/managerChat";
import styles from "@/features/broadcast/chat.module.css";

// Code-first (no Figma frame): 매니저 채팅창 링크 — see docs/figma/code-first-screens.md
// The token in the URL is the secret: no indexing, and no Referer to other sites.
export const metadata: Metadata = { title: "통합 채팅 (매니저) | Ssumnation", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await getManagerChat(token);
  if (view === "FORBIDDEN") {
    return (
      <div className={styles.window}>
        <p>이 매니저 링크는 삭제되었거나 사용할 수 없어요. 크리에이터에게 새 링크를 받아 주세요.</p>
      </div>
    );
  }
  return <ManagerChatScreen token={token} initial={view} />;
}
