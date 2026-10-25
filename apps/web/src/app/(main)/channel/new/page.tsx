import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreateChannelScreen } from "@/features/channel/CreateChannelScreen";
import { FlextvStreamerScreen } from "@/features/channel/FlextvStreamerScreen";
import { FLEXTV_STUDIO } from "@/lib/flextv/mode";
import { forgetFlextvSession, getSession, hasRole } from "@/lib/session";
import { getStreamerGate } from "@/services/channel/flextvStreamer";

// Code-first (no Figma frame): 채널 만들기 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "내 채널 만들기 | Ssumnation" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login?next=/channel/new");
  if (hasRole(session, "CREATOR")) redirect("/creator");
  if (FLEXTV_STUDIO) {
    // With FLEXTV the member's channel exists already: they become a FLEXTV streamer (phase 5).
    const gate = await getStreamerGate();
    if (!gate) {
      // Already a streamer on FLEXTV (e.g. registered there a moment ago): the studio reads the member again.
      await forgetFlextvSession();
      redirect("/creator");
    }
    return <FlextvStreamerScreen gate={gate} />;
  }
  return <CreateChannelScreen />;
}
