import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BlocksScreen } from "@/features/moderation/BlocksScreen";
import { listBlocks } from "@/services/moderation/moderation";

// Code-first (no Figma frame): 차단 관리 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "차단 관리 | Ssumnation" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const blocks = await listBlocks();
  if (!blocks) redirect("/login?next=/mypage/blocks");
  return <BlocksScreen blocks={blocks} />;
}
