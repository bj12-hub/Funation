import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BlocksScreen } from "@/features/moderation/BlocksScreen";
import { getT } from "@/lib/i18n/server";
import { listBlocks } from "@/services/moderation/moderation";

// Code-first (no Figma frame): 차단 관리 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("my.blocksMeta") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const blocks = await listBlocks();
  if (!blocks) redirect("/login?next=/mypage/blocks");
  return <BlocksScreen blocks={blocks} />;
}
