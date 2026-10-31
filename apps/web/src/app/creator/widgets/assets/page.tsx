import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AssetsScreen } from "@/features/creatorStudio/widgets/library/AssetsScreen";
import { getT } from "@/lib/i18n/server";
import { listAssets } from "@/services/creator/assets";

// Code-first (no Figma frame): 이미지·사운드 라이브러리 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("studioToolsLibrary.meta") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const items = await listAssets();
  if (!items) redirect("/login?role=creator&next=/creator/widgets/assets");
  return <AssetsScreen items={items} />;
}
