import Link from "next/link";
import styles from "./apply.module.css";

const TABS = [
  { key: "register", label: "정산 등록", href: "/creator/settlement" },
  { key: "apply", label: "정산 신청", href: "/creator/settlement/apply" },
  { key: "manage", label: "정산 관리", href: "/creator/settlement/manage" }
] as const;

/** Figma 458:49 tab navigation (정산 등록 · 정산 신청 · 정산 관리). 정산 등록 returns to the settlement home. */
export function SettlementTabs({ active }: { active: "apply" | "manage" }) {
  return (
    <nav className={styles.tabs} aria-label="정산 메뉴">
      {TABS.map((t) => (
        <Link key={t.key} href={t.href} className={styles.tab} aria-current={t.key === active ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
