import Link from "next/link";
import type { ReactNode } from "react";
import type { MessageKey } from "@/lib/i18n/translate";
import { MANAGEMENT_TABS, type ManagementTab } from "@/services/creator/donationManagementTypes";
import { koT, type T } from "./translator";
import styles from "./donations.module.css";

const TAB_KEY: Record<ManagementTab, MessageKey> = {
  settings: "studioDonations.tabSettings",
  list: "studioDonations.tabList",
  ranking: "studioDonations.tabRanking",
  filtering: "studioDonations.tabFiltering",
  titles: "studioDonations.tabTitles",
  import: "studioDonations.tabImport"
};

/** 후원관리+ header (Figma 539:* header): title + 5 tabs. */
export function ManagementShell({ tab, children, t = koT }: { tab: ManagementTab; children: ReactNode; t?: T }) {
  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("studioDonations.title")}</h1>
        <nav className={styles.tabs} aria-label={t("studioDonations.menu")}>
          {MANAGEMENT_TABS.map((m) => (
            <Link
              key={m.key}
              href={`/creator/donations?tab=${m.key}`}
              className={`${styles.tab} ${m.key === tab ? styles.tabOn : ""}`}
              aria-current={m.key === tab ? "page" : undefined}
            >
              {t(TAB_KEY[m.key])}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
