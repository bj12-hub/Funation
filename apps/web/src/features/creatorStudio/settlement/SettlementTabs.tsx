import Link from "next/link";
import { FLEXTV_STUDIO } from "@/lib/flextv/mode";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import styles from "./apply.module.css";

const TABS: { key: string; label: MessageKey; href: string }[] = [
  // With FLEXTV (phase 5) the account is registered on FLEXTV's site: the home is 정산 현황.
  { key: "register", label: FLEXTV_STUDIO ? "studioSettlement.tabStatus" : "studioSettlement.tabRegister", href: "/creator/settlement" },
  { key: "apply", label: "studioSettlement.tabApply", href: "/creator/settlement/apply" },
  { key: "manage", label: "studioSettlement.tabManage", href: "/creator/settlement/manage" }
];

/** Figma 458:49 tab navigation (정산 등록 · 정산 신청 · 정산 관리). 정산 등록 returns to the settlement home. */
export async function SettlementTabs({ active }: { active: "register" | "apply" | "manage" }) {
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
