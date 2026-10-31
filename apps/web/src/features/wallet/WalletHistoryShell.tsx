import Link from "next/link";
import type { ReactNode } from "react";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import styles from "./wallet.module.css";

type Tab = "charges" | "donations";

const TABS: { key: Tab; label: MessageKey; href: string }[] = [
  { key: "charges", label: "wallet.chargeHistory", href: "/wallet/charges" },
  { key: "donations", label: "wallet.donationHistory", href: "/wallet/donations" }
];

const COPY: Record<Tab, { crumb: MessageKey; title: MessageKey; description: MessageKey }> = {
  charges: {
    crumb: "wallet.crumbCharges",
    title: "wallet.titleCharges",
    description: "wallet.descriptionCharges"
  },
  donations: {
    crumb: "wallet.crumbDonations",
    title: "wallet.titleDonations",
    description: "wallet.descriptionDonations"
  }
};

/** Tabs + breadcrumb + title shared by 충전내역 (640:2 / 639:2) and 후원내역 (632:4). */
export async function WalletHistoryShell({ tab, children }: { tab: Tab; children: ReactNode }) {
  const t = await getT();
  const copy = COPY[tab];
  return (
    <div className={styles.content}>
      <nav className={styles.tabs} aria-label={t("wallet.history")}>
        {TABS.map((item) => (
          <Link key={item.key} href={item.href} className={`${styles.tab} ${item.key === tab ? styles.tabActive : ""}`} aria-current={item.key === tab ? "page" : undefined}>
            {t(item.label)}
          </Link>
        ))}
      </nav>

      <header className={styles.header}>
        <nav aria-label={t("wallet.breadcrumb")} className={styles.breadcrumb}>
          <Link href="/mypage">{t("common.myPage")}</Link>
          <span aria-hidden="true"> &gt; </span>
          <span>{t("wallet.crumbHistory")}</span>
          <span aria-hidden="true"> &gt; </span>
          <span className={styles.breadcrumbCurrent} aria-current="page">
            {t(copy.crumb)}
          </span>
        </nav>
        <h1 className={styles.title}>{t(copy.title)}</h1>
        <p className={styles.description}>{t(copy.description)}</p>
      </header>

      {children}
    </div>
  );
}
