import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { CreatorSideNav } from "@/features/creatorStudio/CreatorSideNav";
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
    return (
      <>
        <GlobalHeader user={{ nickname: session.nickname, avatarUrl: session.avatarUrl }} />
        <main className={styles.noAccess}>
          <h1 className={styles.noAccessTitle}>크리에이터 권한이 필요합니다</h1>
          <p className={styles.noAccessText}>크리에이터 스튜디오는 채널을 만든 회원만 이용할 수 있어요.</p>
          <Link href="/channel/new" className={styles.noAccessButton}>
            내 채널 만들기
          </Link>
          <Link href="/" className={styles.noAccessLink}>
            홈으로 가기
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
