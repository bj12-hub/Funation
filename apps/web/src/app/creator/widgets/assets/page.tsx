import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AssetsScreen } from "@/features/creatorStudio/widgets/library/AssetsScreen";
import { listAssets } from "@/services/creator/assets";

// Code-first (no Figma frame): 이미지·사운드 라이브러리 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "이미지·사운드 | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const items = await listAssets();
  if (!items) redirect("/login?role=creator&next=/creator/widgets/assets");
  return <AssetsScreen items={items} />;
}
