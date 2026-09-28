import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./wallet.module.css";

type Tab = "charges" | "donations";

const TABS: { key: Tab; label: string; href: string }[] = [
  { key: "charges", label: "충전 내역", href: "/wallet/charges" },
  { key: "donations", label: "후원 내역", href: "/wallet/donations" }
];

const COPY: Record<Tab, { crumb: string; title: string; description: string }> = {
  charges: {
    crumb: "충전내역",
    title: "FN 충전내역",
    description: "결제 수단, 충전 금액, 결제 금액을 포함한 모든 충전 내역을 이곳에서 한눈에 확인하실 수 있습니다."
  },
  donations: {
    crumb: "후원내역",
    title: "FN 후원내역",
    description: "크리에이터에게 마음을 전한 후원내역과 소중한 기록을 이곳에서 투명하게 확인하실 수 있습니다."
  }
};

/** Tabs + breadcrumb + title shared by 충전내역 (640:2 / 639:2) and 후원내역 (632:4). */
export function WalletHistoryShell({ tab, children }: { tab: Tab; children: ReactNode }) {
  const copy = COPY[tab];
  return (
    <div className={styles.content}>
      <nav className={styles.tabs} aria-label="FN 내역">
        {TABS.map((t) => (
          <Link key={t.key} href={t.href} className={`${styles.tab} ${t.key === tab ? styles.tabActive : ""}`} aria-current={t.key === tab ? "page" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>

      <header className={styles.header}>
        <nav aria-label="현재 위치" className={styles.breadcrumb}>
          <Link href="/mypage">마이페이지</Link>
          <span aria-hidden="true"> &gt; </span>
          <span>FN내역</span>
          <span aria-hidden="true"> &gt; </span>
          <span className={styles.breadcrumbCurrent} aria-current="page">
            {copy.crumb}
          </span>
        </nav>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.description}>{copy.description}</p>
      </header>

      {children}
    </div>
  );
}
