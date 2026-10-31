import Link from "next/link";
import { ChargeTrigger } from "@/features/walletCharge";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { LEDGER_FILTER_KINDS, LEDGER_PERIODS, type LedgerKind, type LedgerPeriod, type WalletOverview } from "@/services/wallet/walletTypes";
import styles from "./walletOverview.module.css";

/** The services' LEDGER_KIND_LABEL and LEDGER_PERIODS labels, in the viewer's language. */
const KIND_KEY: Record<LedgerKind, MessageKey> = {
  CHARGE: "wallet.kindCharge",
  USE: "wallet.kindUse",
  REFUND: "wallet.kindRefund",
  RETURN: "wallet.kindReturn",
  REWARD: "wallet.kindReward",
  FORFEIT: "wallet.kindForfeit"
};
const PERIOD_KEY: Record<LedgerPeriod, MessageKey> = { "30": "wallet.last30", "90": "wallet.last90", all: "wallet.allTime" };

/** 유형 chips: 전체 유형 · 충전 · 사용 · 환불 · FN 반환 (2026-10-09 결정) · 적립. */
const KINDS: (LedgerKind | "all")[] = ["all", ...LEDGER_FILTER_KINDS];
const dotted = (s: string) => s.replace(/-/g, ".");
const signed = (n: number) => `${n > 0 ? "+" : "-"}${formatNumber(Math.abs(n))} FN`;

/** Figma 817:7552 — FN Wallet (route `/wallet`). All numbers come from the server. */
export async function WalletOverviewScreen({ view }: { view: WalletOverview }) {
  const t = await getT();
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ kind: view.kind, period: view.period, ...patch });
    if (p.get("kind") === "all") p.delete("kind");
    if (p.get("page") === "1") p.delete("page");
    return `/wallet?${p}`;
  };

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>FN Wallet</h1>
          <p className={styles.subtitle}>{t("wallet.subtitle")}</p>
        </div>
        <ChargeTrigger className={styles.charge}>{t("wallet.charge")}</ChargeTrigger>
      </header>

      <dl className={styles.summary}>
        <div data-tone="available">
          <dt>{t("wallet.available")}</dt>
          <dd>{formatNumber(view.available)} FN</dd>
        </div>
        <div data-tone="locked">
          <dt>{t("wallet.locked")}</dt>
          <dd>{formatNumber(view.locked)} FN</dd>
        </div>
        <div data-tone="used">
          <dt>{t("wallet.totalUsed")}</dt>
          <dd>{formatNumber(view.totalUsed)} FN</dd>
        </div>
      </dl>

      <section className={styles.section} aria-labelledby="wallet-ledger">
        <div className={styles.sectionHead}>
          <h2 id="wallet-ledger" className={styles.sectionTitle}>
            {t("wallet.ledgerTitle")}
          </h2>
          <Link href="/wallet/charges" className={styles.more}>
            {t("wallet.viewHistory")}
          </Link>
        </div>
        <div className={styles.filters}>
          <nav className={styles.chips} aria-label={t("wallet.kind")}>
            {KINDS.map((k) => (
              <Link key={k} href={href({ kind: k, page: "1" })} className={styles.chip} aria-current={view.kind === k ? "page" : undefined}>
                {k === "all" ? t("wallet.allKinds") : t(KIND_KEY[k])}
              </Link>
            ))}
          </nav>
          <nav className={styles.chips} aria-label={t("wallet.ledgerPeriod")}>
            {LEDGER_PERIODS.map((p) => (
              <Link key={p.key} href={href({ period: p.key, page: "1" })} className={styles.chip} aria-current={view.period === p.key ? "page" : undefined}>
                {t(PERIOD_KEY[p.key])}
              </Link>
            ))}
          </nav>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t("wallet.kind")}</th>
                <th scope="col">{t("wallet.description")}</th>
                <th scope="col">{t("wallet.amount")}</th>
                <th scope="col">{t("wallet.state")}</th>
                <th scope="col">{t("wallet.at")}</th>
              </tr>
            </thead>
            <tbody>
              {view.entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    {t("wallet.noEntries")}
                  </td>
                </tr>
              ) : (
                view.entries.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span className={styles.kind} data-kind={e.kind}>
                        {t(KIND_KEY[e.kind])}
                      </span>
                    </td>
                    <td className={styles.desc}>{e.description}</td>
                    <td className={styles.delta} data-plus={e.deltaFn > 0 || undefined}>
                      {signed(e.deltaFn)}
                    </td>
                    <td>
                      <span className={styles.status} data-tone={e.tone}>
                        {e.statusLabel}
                      </span>
                    </td>
                    <td>{dotted(e.at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {view.totalPages > 1 && (
          <nav className={styles.pagination} aria-label={t("wallet.pages")}>
            {Array.from({ length: view.totalPages }, (_, i) => i + 1).map((n) => (
              <Link key={n} href={href({ page: String(n) })} className={styles.page} aria-current={n === view.page ? "page" : undefined}>
                {n}
              </Link>
            ))}
          </nav>
        )}
      </section>
    </div>
  );
}
