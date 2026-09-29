import Link from "next/link";
import { SETTLEMENT_STATUS_LABEL, type SettlementApplyView } from "@/services/creator/settlementTypes";
import { SettlementRequestFlow } from "./SettlementRequestFlow";
import { SettlementTabs } from "./SettlementTabs";
import styles from "./apply.module.css";

const fn = (n: number) => n.toLocaleString("ko-KR");

/** Figma 458:4 (default) · 463:2 (after a request) — 정산 신청 (route `/creator/settlement/apply`). */
export function SettlementApplyScreen({ view }: { view: SettlementApplyView }) {
  const max = Math.max(...view.monthly.map((m) => m.krw), 0);
  // Five axis labels from the rounded-up maximum down to 0, like 458:115.
  const top = Math.ceil(max / 20_000) * 20_000;
  const ticks = [4, 3, 2, 1, 0].map((i) => (top * i) / 4);

  return (
    <div className={styles.content}>
      <SettlementTabs active="apply" />
      <h1 className={styles.pageTitle}>Funation 정산 현황</h1>

      <div className={styles.topRow}>
        <SettlementRequestFlow view={view} />

        <section className={styles.accountCard} aria-labelledby="settle-code">
          <div className={styles.codeBlock}>
            <span id="settle-code" className={styles.muted}>
              {view.registrant} 님의 정산 코드
            </span>
            <strong className={styles.code}>{view.code}</strong>
          </div>
          <hr className={styles.cardDivider} />
          <div className={styles.bankBlock}>
            <span className={styles.muted}>정산 계좌 정보</span>
            <dl className={styles.bankTable}>
              <div>
                <dt>은행명</dt>
                <dd>{view.bankName}</dd>
              </div>
              <div>
                <dt>계좌</dt>
                <dd>{view.accountMasked}</dd>
              </div>
              <div>
                <dt>예금주</dt>
                <dd>{view.holder}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>

      <div className={styles.bottomRow}>
        <section className={styles.chartSection} aria-labelledby="settle-monthly">
          <h2 id="settle-monthly" className={styles.sectionTitle}>
            월별 정산 받은 금액
          </h2>
          <div className={styles.chartBox}>
            {max === 0 ? (
              <p className={styles.empty}>정산 받은 내역이 없습니다.</p>
            ) : (
              <div className={styles.chart}>
                <ol className={styles.yAxis} aria-hidden="true">
                  {ticks.map((t) => (
                    <li key={t}>{fn(t)}</li>
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
              최근 정산 내역
            </h2>
            <Link href="/creator/settlement/manage" className={styles.moreButton}>
              더보기
            </Link>
          </div>
          <div className={styles.historyBox}>
            {view.recent.length === 0 ? (
              <p className={styles.empty}>정산 내역이 없습니다.</p>
            ) : (
              <ul className={styles.historyList}>
                {view.recent.map((r) => (
                  <li key={r.id} className={styles.historyRow}>
                    <span className={styles.historyLeft}>
                      <span className={styles.badge} data-status={r.status}>
                        {SETTLEMENT_STATUS_LABEL[r.status]}
                      </span>
                      <span className={styles.muted}>{r.requestedAt.slice(0, 7)}</span>
                    </span>
                    <strong className={styles.historyAmount}>{r.status === "REJECTED" ? `${fn(r.amountFn)} FN` : `${fn(r.netKrw)} 원`}</strong>
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
