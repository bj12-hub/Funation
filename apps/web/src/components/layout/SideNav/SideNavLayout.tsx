import type { ReactNode } from "react";
import { SideNav, type SideNavUser } from "./SideNav";
import styles from "./SideNavLayout.module.css";

/** 260px side navigation + content column (Figma 617:343 main-wrapper). */
export function SideNavLayout({ user, showWatchHistory, children }: { user: SideNavUser | null; showWatchHistory?: boolean; children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <SideNav user={user} showWatchHistory={showWatchHistory} />
      <div className={styles.main}>{children}</div>
    </div>
  );
}
