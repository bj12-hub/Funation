import type { Metadata } from "next";
import { HelperHome } from "@/features/helper/HelperHome";
import { helperTitle } from "@/features/helper/helperText";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";
import { getOverlaySwitches } from "@/services/creator/alertRemote";

// Code-first (no Figma frame): 도우미 시작하기 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: helperTitle(await getT()) } };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  // Signed out or without a channel, the layout shows its own screen instead of this page.
  const [session, switches] = await Promise.all([getSession(), getOverlaySwitches()]);
  if (!session || !switches) return null;
  return <HelperHome nickname={session.nickname} switches={switches} />;
}
