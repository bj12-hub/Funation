import Link from "next/link";
import styles from "./live.module.css";

const TABS = [
  { key: "popular", label: "인기라이브", href: "/live/popular" },
  { key: "all", label: "전체라이브", href: "/live" }
] as const;

/** Figma 617:401 — title + 인기라이브 / 전체라이브 tabs */
export function LivePageHeader({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>추천 라이브 방송</h1>
        <span className={styles.titleBadge}>LIVE</span>
      </div>
      <nav className={styles.tabs} aria-label="라이브 목록">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`${styles.tab} ${tab.key === active ? styles.tabActive : ""}`}
            aria-current={tab.key === active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
