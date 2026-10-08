import type { ChargeRecord, HistoryPage, WalletSummary } from "@/services/wallet/walletTypes";
import { BalanceCard } from "./BalanceCard";
import { ChargeTable } from "./ChargeTable";
import { HistoryFilter } from "./HistoryFilter";
import { HistoryFooter } from "./HistoryFooter";
import { WalletHistoryShell } from "./WalletHistoryShell";
import { historyQuery } from "./historyParams";
import styles from "./wallet.module.css";

/** Figma 640:2 (data) · 639:2 (empty) — route `/wallet/charges`. */
export function ChargeHistoryScreen({ summary, data }: { summary: WalletSummary; data: HistoryPage<ChargeRecord> }) {
  const { period } = data;
  return (
    <WalletHistoryShell tab="charges">
      <BalanceCard summary={summary} />
      <section className={styles.card} aria-label="충전 내역">
        {/* key: reset the filter's local state when the applied period changes */}
        <HistoryFilter key={`${period.preset}${period.from}${period.to}`} basePath="/wallet/charges" period={period} />
        <ChargeTable items={data.items} />
        <HistoryFooter
          page={data.page}
          totalPages={data.totalPages}
          hrefFor={(page) => `/wallet/charges${historyQuery({ period, page })}`}
          csvHref={`/api/wallet/charges${historyQuery({ period })}`}
          hasRows={data.totalCount > 0}
        />
      </section>
    </WalletHistoryShell>
  );
}
