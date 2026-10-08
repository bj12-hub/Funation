import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignaturesScreen } from "@/features/creatorStudio/widgets/SignaturesScreen";
import { listAssets } from "@/services/creator/assets";
import { listSignatures } from "@/services/donations/signatures";

// Code-first (no Figma frame): 시그니처 후원 관리 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "시그니처 후원 | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const [items, library, raw] = await Promise.all([listSignatures(), listAssets(), searchParams]);
  if (!items || !library) redirect("/login?role=creator&next=/creator/widgets/signatures");
  // `?bulk=1` (이미지·사운드 page link) opens 한 번에 만들기.
  return <SignaturesScreen items={items} library={library} startBulk={raw.bulk === "1"} />;
}
