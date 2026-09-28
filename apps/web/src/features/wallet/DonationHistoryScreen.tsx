import { DONATION_CATEGORY_LABEL, type DonationCategory, type DonationRecord, type HistoryPage } from "@/services/wallet/walletTypes";
import { DonationTable } from "./DonationTable";
import { HistoryFilter } from "./HistoryFilter";
import { HistoryFooter } from "./HistoryFooter";
import { WalletHistoryShell } from "./WalletHistoryShell";
import { historyQuery } from "./historyParams";
import styles from "./wallet.module.css";

const CATEGORIES = (Object.keys(DONATION_CATEGORY_LABEL) as DonationCategory[]).map((key) => ({ key, label: DONATION_CATEGORY_LABEL[key] }));

/** Figma 632:4 (data) · 637:214 (empty) — route `/wallet/donations`. */
export function DonationHistoryScreen({ data, category }: { data: HistoryPage<DonationRecord>; category: DonationCategory }) {
  const { period } = data;
  return (
    <WalletHistoryShell tab="donations">
      <section className={styles.card} aria-label="후원 내역">
        <HistoryFilter
          key={`${category}${period.preset}${period.from}${period.to}`}
          basePath="/wallet/donations"
          period={period}
          categories={CATEGORIES}
          category={category}
        />
        <DonationTable items={data.items} />
        <HistoryFooter
          page={data.page}
          totalPages={data.totalPages}
          hrefFor={(page) => `/wallet/donations${historyQuery({ period, category, page })}`}
          csvHref={`/api/wallet/donations${historyQuery({ period, category })}`}
          hasRows={data.totalCount > 0}
        />
      </section>
    </WalletHistoryShell>
  );
}
