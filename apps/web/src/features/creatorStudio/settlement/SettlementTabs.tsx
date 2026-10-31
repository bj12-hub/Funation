import Link from "next/link";
import { FLEXTV_STUDIO } from "@/lib/flextv/mode";
import styles from "./apply.module.css";

const TABS = [
  // With FLEXTV (phase 5) the account is registered on FLEXTV's site: the home is 정산 현황.
  { key: "register", label: FLEXTV_STUDIO ? "정산 현황" : "정산 등록", href: "/creator/settlement" },
  { key: "apply", label: "정산 신청", href: "/creator/settlement/apply" },
  { key: "manage", label: "정산 관리", href: "/creator/settlement/manage" }
] as const;

/** Figma 458:49 tab navigation (정산 등록 · 정산 신청 · 정산 관리). 정산 등록 returns to the settlement home. */
export function SettlementTabs({ active }: { active: "register" | "apply" | "manage" }) {
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
