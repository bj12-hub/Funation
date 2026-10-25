import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BroadcastScreen } from "@/features/creatorStudio/broadcast/BroadcastScreen";
import { FLEXTV_STUDIO } from "@/lib/flextv/mode";
import { getBroadcastView } from "@/services/creator/broadcast";

// Code-first (no Figma frame): 방송 설정 on FLEXTV (phase 5) — FLEXTV's broadcast page is the reference.
export const metadata: Metadata = { title: "방송 설정 | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  // Broadcasting is FLEXTV's: the mock studio has no stream to set up.
  if (!FLEXTV_STUDIO) notFound();
  const view = await getBroadcastView();
  if (!view) redirect("/login?role=creator&next=/creator/broadcast");
  return <BroadcastScreen view={view} />;
}
