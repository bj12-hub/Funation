import type { Metadata } from "next";
import { ManagerChatScreen } from "@/features/broadcast/UnifiedChatScreen";
import { getManagerChat } from "@/services/broadcast/managerChat";
import styles from "@/features/broadcast/chat.module.css";
import { getT } from "@/lib/i18n/server";

// Code-first (no Figma frame): 매니저 채팅창 링크 — see docs/figma/code-first-screens.md
// The token in the URL is the secret: no indexing, and no Referer to other sites.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("unifiedChat.metaManager"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await getManagerChat(token);
  if (view === "FORBIDDEN") {
    const t = await getT();
    return (
      <div className={styles.window}>
        <p>{t("unifiedChat.managerGone")}</p>
      </div>
    );
  }
  return <ManagerChatScreen token={token} initial={view} />;
}
