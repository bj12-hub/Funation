"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "./crew.module.css";

/** 크루 관리 sub-navigation (code-first). */
export function CrewTabs({ active }: { active: "members" | "broadcast" | "games" }) {
  const { t } = useI18n();
  return (
    <nav className={styles.tabs} aria-label={t("crewOps.tabsAria")}>
      <Link href="/creator/crew" className={styles.tab} aria-current={active === "members" ? "page" : undefined}>
        {t("crewOps.tabMembers")}
      </Link>
      <Link href="/creator/crew/broadcast" className={styles.tab} aria-current={active === "broadcast" ? "page" : undefined}>
        {t("crewOps.tabBroadcast")}
      </Link>
      <Link href="/creator/crew/games" className={styles.tab} aria-current={active === "games" ? "page" : undefined}>
        {t("crewOps.tabGames")}
      </Link>
    </nav>
  );
}
