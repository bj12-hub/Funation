import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { CreatorSideNav } from "@/features/creatorStudio/CreatorSideNav";
import { getT } from "@/lib/i18n/server";
import { getSession, hasRole } from "@/lib/session";
import { getCreatorProfile } from "@/services/creator/creatorStudio";
import styles from "@/features/creatorStudio/studio.module.css";

// Figma 03 Creator Core (245:14): creator nav + 240px sidebar. Members with the Creator role only.
export const dynamic = "force-dynamic";

export default async function CreatorLayout({ children }: { children: ReactNode }) {
  // Route guard for UX only; every creator service re-checks the Creator role on the server
  // (getCreatorSession), and the real backend must enforce it on every request.
  const session = await getSession();
  if (!session) redirect("/login?role=creator&next=/creator");

  if (!hasRole(session, "CREATOR")) {
    // Code-first (no Figma frame): members become creators by creating a channel (approval TBD).
    const t = await getT();
    return (
      <>
        <GlobalHeader user={{ nickname: session.nickname, avatarUrl: session.avatarUrl }} />
        <main className={styles.noAccess}>
          <h1 className={styles.noAccessTitle}>{t("studioNav.noAccessTitle")}</h1>
          <p className={styles.noAccessText}>{t("studioNav.noAccessText")}</p>
          <Link href="/channel/new" className={styles.noAccessButton}>
            {t("studioNav.createChannel")}
          </Link>
          <Link href="/" className={styles.noAccessLink}>
            {t("studioNav.goHome")}
          </Link>
        </main>
      </>
    );
  }

  const profile = await getCreatorProfile();
  if (!profile) redirect("/login?role=creator&next=/creator");

  // The studio keeps the dark theme (its Figma frames and several hardcoded colors are dark-only; light TBD).
  return (
    <div data-theme="dark" className={styles.themeScope}>
      <GlobalHeader
        user={{ nickname: session.nickname, avatarUrl: session.avatarUrl }}
        creator={{ channelName: profile.channelName, platforms: profile.platforms }}
      />
      <div className={styles.shell}>
        <CreatorSideNav />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
