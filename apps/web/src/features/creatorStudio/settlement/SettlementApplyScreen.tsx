import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import type { SettlementApplyView } from "@/services/creator/settlementTypes";
import { SETTLEMENT_STATUS_KEY } from "./settlementLabels";
import { SettlementRequestFlow } from "./SettlementRequestFlow";
import { SettlementTabs } from "./SettlementTabs";
import styles from "./apply.module.css";

const fn = (n: number) => n.toLocaleString("ko-KR");

/** Figma 458:4 (default) · 463:2 (after a request) — 정산 신청 (route `/creator/settlement/apply`). */
export async function SettlementApplyScreen({ view }: { view: SettlementApplyView }) {
  const t = await getT();
  const max = Math.max(...view.monthly.map((m) => m.krw), 0);
  // Five axis labels from the rounded-up maximum down to 0, like 458:115.
  const top = Math.ceil(max / 20_000) * 20_000;
  const ticks = [4, 3, 2, 1, 0].map((i) => (top * i) / 4);

  return (
    <div className={styles.content}>
      <SettlementTabs active="apply" />
      <h1 className={styles.pageTitle}>{t("studioSettlement.overviewTitle")}</h1>

      <div className={styles.topRow}>
        <SettlementRequestFlow view={view} />

        <section className={styles.accountCard} aria-labelledby="settle-code">
          <div className={styles.codeBlock}>
            <span id="settle-code" className={styles.muted}>
              {t("studioSettlementApply.codeOf", { name: view.registrant })}
            </span>
            <strong className={styles.code}>{view.code}</strong>
          </div>
          <hr className={styles.cardDivider} />
          <div className={styles.bankBlock}>
            <span className={styles.muted}>{t("studioSettlementApply.accountInfo")}</span>
            <dl className={styles.bankTable}>
              <div>
                <dt>{t("studioSettlementApply.bank")}</dt>
                <dd>{view.bankName}</dd>
              </div>
              <div>
                <dt>{t("studioSettlementApply.account")}</dt>
                <dd>{view.accountMasked}</dd>
              </div>
              <div>
                <dt>{t("studioSettlementApply.holder")}</dt>
                <dd>{view.holder}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>

      <div className={styles.bottomRow}>
        <section className={styles.chartSection} aria-labelledby="settle-monthly">
          <h2 id="settle-monthly" className={styles.sectionTitle}>
            {t("studioSettlementApply.monthlyTitle")}
          </h2>
          <div className={styles.chartBox}>
            {max === 0 ? (
              <p className={styles.empty}>{t("studioSettlementApply.noPayouts")}</p>
            ) : (
              <div className={styles.chart}>
                <ol className={styles.yAxis} aria-hidden="true">
                  {ticks.map((tick) => (
                    <li key={tick}>{fn(tick)}</li>
                  ))}
                </ol>
                <ol className={styles.bars}>
                  {view.monthly.map((m) => (
                    <li key={m.month} className={styles.barGroup}>
                      <span
                        className={styles.bar}
                        data-empty={m.krw === 0 || undefined}
                        style={{ height: m.krw === 0 ? 2 : `${Math.max(3, (m.krw / top) * 100)}%` }}
                        title={`${m.month} · ${fn(m.krw)}원`}
                      />
                      <span className={styles.barLabel}>{m.month.slice(5)}</span>
                      <span className={styles.srOnly}>
                        {m.month} {fn(m.krw)}원
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </section>

        <section className={styles.historySection} aria-labelledby="settle-recent">
          <div className={styles.sectionHead}>
            <h2 id="settle-recent" className={styles.sectionTitle}>
              {t("studioSettlementApply.recentTitle")}
            </h2>
            <Link href="/creator/settlement/manage" className={styles.moreButton}>
              {t("studioSettlementApply.more")}
            </Link>
          </div>
          <div className={styles.historyBox}>
            {view.recent.length === 0 ? (
              <p className={styles.empty}>{t("studioSettlementApply.noHistory")}</p>
            ) : (
              <ul className={styles.historyList}>
                {view.recent.map((r) => (
                  <li key={r.id} className={styles.historyRow}>
                    <span className={styles.historyLeft}>
                      <span className={styles.badge} data-status={r.status}>
                        {t(SETTLEMENT_STATUS_KEY[r.status])}
                      </span>
                      <span className={styles.muted}>{r.requestedAt.slice(0, 7)}</span>
                    </span>
                    <strong className={styles.historyAmount}>{r.status === "REJECTED" || r.status === "FORFEITED" ? `${fn(r.amountFn)} FN` : `${fn(r.netKrw)} 원`}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
