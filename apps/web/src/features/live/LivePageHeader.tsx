import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import styles from "./live.module.css";

const TABS = [
  { key: "popular", label: "live.popular", href: "/live/popular" },
  { key: "all", label: "live.all", href: "/live" }
] as const;

/**
 * 전체 방송 header — funnation structure: title + one-line description; 인기 라이브 / 전체 라이브
 * tabs (the same pair as the home 전체 방송 block). Figma 617:401 tab style.
 */
export async function LivePageHeader({ active }: { active: (typeof TABS)[number]["key"] }) {
  const t = await getT();
  return (
    <header className={styles.pageHeader}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{t("live.title")}</h1>
        <span className={styles.titleBadge}>LIVE</span>
      </div>
      <p className={styles.pageDescription}>{t("live.description")}</p>
      <nav className={styles.tabs} aria-label={t("live.tabs")}>
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`${styles.tab} ${tab.key === active ? styles.tabActive : ""}`}
            aria-current={tab.key === active ? "page" : undefined}
          >
            {t(tab.label)}
          </Link>
        ))}
      </nav>
    </header>
  );
}
