import { ChargeTrigger } from "@/features/walletCharge";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { WalletSummary } from "@/services/wallet/walletTypes";
import styles from "./wallet.module.css";

/** Figma 640:2 현재 보유 FN card. Values are server-owned and display-only. */
export async function BalanceCard({ summary }: { summary: WalletSummary }) {
  const t = await getT();
  return (
    <section className={styles.balanceCard} aria-labelledby="wallet-balance">
      <div className={styles.balanceText}>
        <h2 id="wallet-balance" className={styles.balanceLabel}>
          {t("wallet.balance")}
        </h2>
        <strong className={styles.balanceValue}>{formatNumber(summary.balance)} FN</strong>
        <p className={styles.balanceMeta}>
          <span className={styles.metaAvailable}>{t("wallet.balanceAvailable", { amount: formatNumber(summary.available) })}</span>
          <span className={styles.metaExpiring}>{t("wallet.balanceExpiring", { amount: formatNumber(summary.expiring) })}</span>
        </p>
      </div>
      <ChargeTrigger className={styles.chargeButton} />
    </section>
  );
}
