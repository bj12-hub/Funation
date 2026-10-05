import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignaturesScreen } from "@/features/creatorStudio/widgets/SignaturesScreen";
import { listAssets } from "@/services/creator/assets";
import { listSignatures } from "@/services/donations/signatures";

// Code-first (no Figma frame): 시그니처 후원 관리 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "시그니처 후원 | Somnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [items, library] = await Promise.all([listSignatures(), listAssets()]);
  if (!items || !library) redirect("/login?role=creator&next=/creator/widgets/signatures");
  return <SignaturesScreen items={items} library={library} />;
}
