import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreateChannelScreen } from "@/features/channel/CreateChannelScreen";
import { getT } from "@/lib/i18n/server";
import { getSession, hasRole } from "@/lib/session";

// Code-first (no Figma frame): 채널 만들기 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("channel.meta") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login?next=/channel/new");
  if (hasRole(session, "CREATOR")) redirect("/creator");
  return <CreateChannelScreen />;
}
