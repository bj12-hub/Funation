import type { Metadata } from "next";
import type { ReactNode } from "react";
import { HelperLanding, HelperNeedsChannel } from "@/features/helper/HelperLanding";
import { HelperShell } from "@/features/helper/HelperShell";
import { HELPER_TITLE } from "@/features/helper/helperNav";
import { getSession, hasRole } from "@/lib/session";
import { getHelperPath } from "@/lib/surface";
import { getCreatorProfile } from "@/services/creator/creatorStudio";

// Ssumnation 도우미 (helper domain, 2026-10-14 결정) — code-first (no Figma frame). Served at the helper host's top
// level by the middleware (`/chat` → `/helper/chat`); see docs/development/helper-domain.md.
export const metadata: Metadata = {
  title: { template: `%s | ${HELPER_TITLE}`, default: HELPER_TITLE },
  robots: { index: false, follow: false }
};
export const dynamic = "force-dynamic";

export default async function HelperLayout({ children }: { children: ReactNode }) {
  // Navigation only: every page and server action re-checks the Creator role on the server (getCreatorSession),
  // and the real backend must enforce it on every request.
  const session = await getSession();
  if (!session) return <HelperLanding next={await getHelperPath()} />;
  if (!hasRole(session, "CREATOR")) return <HelperNeedsChannel nickname={session.nickname} />;

  const profile = await getCreatorProfile();
  if (!profile) return <HelperLanding next={await getHelperPath()} />;

  return (
    <HelperShell user={{ nickname: session.nickname, channelName: profile.channelName, avatarUrl: profile.avatarUrl, platforms: profile.platforms }}>
      {children}
    </HelperShell>
  );
}
