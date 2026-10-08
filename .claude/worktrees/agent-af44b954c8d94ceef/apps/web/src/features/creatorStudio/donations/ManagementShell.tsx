import Link from "next/link";
import type { ReactNode } from "react";
import { MANAGEMENT_TABS, type ManagementTab } from "@/services/creator/donationManagementTypes";
import styles from "./donations.module.css";

/** 후원관리+ header (Figma 539:* header): title + 5 tabs. */
export function ManagementShell({ tab, children }: { tab: ManagementTab; children: ReactNode }) {
  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>후원관리+</h1>
        <nav className={styles.tabs} aria-label="후원관리 메뉴">
          {MANAGEMENT_TABS.map((t) => (
            <Link
              key={t.key}
              href={`/creator/donations?tab=${t.key}`}
              className={`${styles.tab} ${t.key === tab ? styles.tabOn : ""}`}
              aria-current={t.key === tab ? "page" : undefined}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
