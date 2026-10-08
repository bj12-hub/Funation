import Link from "next/link";
import styles from "./live.module.css";

const TABS = [
  { key: "popular", label: "인기 라이브", href: "/live/popular" },
  { key: "all", label: "전체 라이브", href: "/live" }
] as const;

/**
 * 전체 방송 header — funnation structure: title + one-line description; 인기 라이브 / 전체 라이브
 * tabs (the same pair as the home 전체 방송 block). Figma 617:401 tab style.
 */
export function LivePageHeader({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>전체 방송</h1>
        <span className={styles.titleBadge}>LIVE</span>
      </div>
      <p className={styles.pageDescription}>지금 방송 중인 라이브를 한곳에서 만나보세요.</p>
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
