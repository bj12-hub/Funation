import Link from "next/link";
import type { ReactNode } from "react";
import { FLEXTV_STUDIO } from "@/lib/flextv/mode";
import { MANAGEMENT_TABS, type ManagementTab } from "@/services/creator/donationManagementTypes";
import styles from "./donations.module.css";

/** With FLEXTV (phase 5) the page is 받은 후원 alone. */
const TABS = FLEXTV_STUDIO ? [{ key: "list", label: "받은 후원" } as const] : MANAGEMENT_TABS;

/** 후원관리+ header (Figma 539:* header): title + 5 tabs. */
export function ManagementShell({ tab, children }: { tab: ManagementTab; children: ReactNode }) {
  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{FLEXTV_STUDIO ? "받은 후원" : "후원관리+"}</h1>
        <nav className={styles.tabs} aria-label="후원관리 메뉴">
          {TABS.map((t) => (
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
