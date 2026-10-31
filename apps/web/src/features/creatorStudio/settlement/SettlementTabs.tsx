import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import styles from "./apply.module.css";

const TABS: { key: string; label: MessageKey; href: string }[] = [
  { key: "register", label: "studioSettlement.tabRegister", href: "/creator/settlement" },
  { key: "apply", label: "studioSettlement.tabApply", href: "/creator/settlement/apply" },
  { key: "manage", label: "studioSettlement.tabManage", href: "/creator/settlement/manage" }
];

/** Figma 458:49 tab navigation (정산 등록 · 정산 신청 · 정산 관리). 정산 등록 returns to the settlement home. */
export async function SettlementTabs({ active }: { active: "apply" | "manage" }) {
  const t = await getT();
  return (
    <nav className={styles.tabs} aria-label={t("studioSettlement.menu")}>
      {TABS.map((tab) => (
        <Link key={tab.key} href={tab.href} className={styles.tab} aria-current={tab.key === active ? "page" : undefined}>
          {t(tab.label)}
        </Link>
      ))}
    </nav>
  );
}
