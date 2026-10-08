import { ChargeTrigger } from "@/features/walletCharge";
import { formatNumber } from "@/lib/format";
import type { WalletSummary } from "@/services/wallet/walletTypes";
import styles from "./wallet.module.css";

/** Figma 640:2 현재 보유 FN card. Values are server-owned and display-only. */
export function BalanceCard({ summary }: { summary: WalletSummary }) {
  return (
    <section className={styles.balanceCard} aria-labelledby="wallet-balance">
      <div className={styles.balanceText}>
        <h2 id="wallet-balance" className={styles.balanceLabel}>
          현재 보유 FN
        </h2>
        <strong className={styles.balanceValue}>{formatNumber(summary.balance)} FN</strong>
        <p className={styles.balanceMeta}>
          <span className={styles.metaAvailable}>사용 가능 FN {formatNumber(summary.available)} FN</span>
          <span className={styles.metaExpiring}>소멸 예정 FN {formatNumber(summary.expiring)} FN</span>
        </p>
      </div>
      <ChargeTrigger className={styles.chargeButton} />
    </section>
  );
}
