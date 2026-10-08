import Link from "next/link";
import { ChargeTrigger } from "@/features/walletCharge";
import { formatNumber } from "@/lib/format";
import { LEDGER_KIND_LABEL, LEDGER_PERIODS, type LedgerKind, type WalletOverview } from "@/services/wallet/walletTypes";
import styles from "./walletOverview.module.css";

const KINDS: (LedgerKind | "all")[] = ["all", "CHARGE", "USE", "REFUND", "REWARD"];
const dotted = (s: string) => s.replace(/-/g, ".");
const signed = (n: number) => `${n > 0 ? "+" : "-"}${formatNumber(Math.abs(n))} FN`;

/** Figma 817:7552 — FN Wallet (route `/wallet`). All numbers come from the server. */
export function WalletOverviewScreen({ view }: { view: WalletOverview }) {
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
          <p className={styles.subtitle}>FN 잔액과 충전·사용·환불 내역을 한눈에 관리하세요.</p>
        </div>
        <ChargeTrigger className={styles.charge}>+ FN 충전</ChargeTrigger>
      </header>

      <dl className={styles.summary}>
        <div data-tone="available">
          <dt>사용 가능</dt>
          <dd>{formatNumber(view.available)} FN</dd>
        </div>
        <div data-tone="locked">
          <dt>보류 중</dt>
          <dd>{formatNumber(view.locked)} FN</dd>
        </div>
        <div data-tone="used">
          <dt>누적 사용</dt>
          <dd>{formatNumber(view.totalUsed)} FN</dd>
        </div>
      </dl>

      <section className={styles.section} aria-labelledby="wallet-ledger">
        <div className={styles.sectionHead}>
          <h2 id="wallet-ledger" className={styles.sectionTitle}>
            충전 및 거래 내역
          </h2>
          <Link href="/wallet/charges" className={styles.more}>
            FN 내역 자세히 보기 ›
          </Link>
        </div>
        <div className={styles.filters}>
          <nav className={styles.chips} aria-label="유형">
            {KINDS.map((k) => (
              <Link key={k} href={href({ kind: k, page: "1" })} className={styles.chip} aria-current={view.kind === k ? "page" : undefined}>
                {k === "all" ? "전체 유형" : LEDGER_KIND_LABEL[k]}
              </Link>
            ))}
          </nav>
          <nav className={styles.chips} aria-label="기간">
            {LEDGER_PERIODS.map((p) => (
              <Link key={p.key} href={href({ period: p.key, page: "1" })} className={styles.chip} aria-current={view.period === p.key ? "page" : undefined}>
                {p.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">유형</th>
                <th scope="col">내용</th>
                <th scope="col">금액</th>
                <th scope="col">상태</th>
                <th scope="col">일시</th>
              </tr>
            </thead>
            <tbody>
              {view.entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    조회된 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                view.entries.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span className={styles.kind} data-kind={e.kind}>
                        {LEDGER_KIND_LABEL[e.kind]}
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
          <nav className={styles.pagination} aria-label="페이지">
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
