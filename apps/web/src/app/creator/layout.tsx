import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { CreatorSideNav } from "@/features/creatorStudio/CreatorSideNav";
import { getSession } from "@/lib/session";
import { getCreatorProfile } from "@/services/creator/creatorStudio";
import styles from "@/features/creatorStudio/studio.module.css";

// Figma 03 Creator Core (245:14): creator nav + 240px sidebar. Signed-in creators only.
export const dynamic = "force-dynamic";

export default async function CreatorLayout({ children }: { children: ReactNode }) {
  // Route guard for UX only; every creator API must authorize the creator role on the server (TBD).
  const [session, profile] = await Promise.all([getSession(), getCreatorProfile()]);
  if (!session || !profile) redirect("/login?role=creator&next=/creator");

  return (
    <>
      <GlobalHeader
        user={{ nickname: session.nickname, avatarUrl: session.avatarUrl }}
        creator={{ channelName: profile.channelName, platforms: profile.platforms }}
      />
      <div className={styles.shell}>
        <CreatorSideNav />
        <main className={styles.main}>{children}</main>
      </div>
    </>
  );
}
