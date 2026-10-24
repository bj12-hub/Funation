import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MusicEditorScreen } from "@/features/creatorStudio/music/MusicEditorScreen";
import { listAssets } from "@/services/creator/assets";

// Code-first (no Figma frame): 음악 편집기 — see docs/figma/code-first-screens.md. The microphone is allowed on this page only (next.config.ts).
export const metadata: Metadata = { title: "음악 편집기 | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const sounds = await listAssets("SOUND");
  if (!sounds) redirect("/login?role=creator&next=/creator/widgets/music");
  return <MusicEditorScreen sounds={sounds} />;
}
