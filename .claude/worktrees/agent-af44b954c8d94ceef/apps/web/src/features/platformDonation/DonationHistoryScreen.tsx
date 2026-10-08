import Link from "next/link";
import { formatNumber } from "@/lib/format";
import { HISTORY_LIST_MAX, HISTORY_STATUS_LABEL, HISTORY_TABS, SOURCE_LABEL, type HistoryItem, type HistoryView } from "@/services/platformDonation/platformTypes";
import { HistoryFilters } from "./HistoryFilters";
import styles from "./history.module.css";

const dotted = (s: string) => s.replace(/-/g, ".");

/** Figma 817:8038 · 817:8223 — 후원 내역 (route `/donation/history`). */
export function DonationHistoryScreen({ view }: { view: HistoryView }) {
  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams({ tab: view.tab, period: view.period, status: view.status, q: view.q, sort: view.sort });
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    for (const [k, v] of [...p.entries()]) if (!v || (k === "status" && v === "all") || (k === "sort" && v === "newest")) p.delete(k);
    return `/donation/history?${p}`;
  };

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>후원 내역</h1>
        <p className={styles.subtitle}>플랫폼별 후원 거래와 처리 결과를 확인하세요.</p>
      </header>

      <nav className={styles.tabs} aria-label="플랫폼">
        {HISTORY_TABS.map((t) => (
          <Link key={t.key} href={href({ tab: t.key, tx: null })} className={styles.tab} aria-current={view.tab === t.key ? "page" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>

      <HistoryFilters key={`${view.tab}-${view.period}-${view.status}-${view.q}-${view.sort}`} tab={view.tab} period={view.period} status={view.status} q={view.q} sort={view.sort} />

      {/* Code-first (2026-10-06): 결과 건수 · 완료 합계 over every match, like FN 내역's 결과 · 합계. */}
      <p className={styles.summary} role="status">
        결과 {formatNumber(view.total)}건 · 완료 합계 {formatNumber(view.completedFn)} FN
        {view.total > HISTORY_LIST_MAX && ` · 목록은 ${HISTORY_LIST_MAX}건까지 보여요`}
      </p>

      <div className={styles.body}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">거래일시</th>
                <th scope="col">플랫폼</th>
                <th scope="col">크리에이터</th>
                <th scope="col">상품</th>
                <th scope="col">금액</th>
                <th scope="col">상태</th>
              </tr>
            </thead>
            <tbody>
              {view.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.empty}>
                    조회된 후원 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                view.items.map((i) => (
                  <tr key={i.transactionId} aria-selected={view.selected?.transactionId === i.transactionId || undefined}>
                    <td>
                      <Link href={href({ tx: i.transactionId })} className={styles.rowLink} scroll={false}>
                        {dotted(i.createdAt)}
                      </Link>
                    </td>
                    <td>{SOURCE_LABEL[i.source]}</td>
                    <td>{i.creatorName}</td>
                    <td>{i.productLabel}</td>
                    <td className={styles.amount}>{formatNumber(i.fnAmount)} FN</td>
                    <td>
                      <StatusBadge item={i} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <aside className={styles.detail} aria-label="거래 상세">
          <div className={styles.detailHead}>
            <h2 className={styles.detailTitle}>거래 상세</h2>
            {view.selected && (
              <Link href={href({ tx: null })} className={styles.close} aria-label="거래 상세 닫기" scroll={false}>
                ×
              </Link>
            )}
          </div>
          {view.selected ? (
            <Detail item={view.selected} />
          ) : (
            <p className={styles.detailEmpty}>목록에서 거래를 선택하면 상세 정보를 볼 수 있어요.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function StatusBadge({ item }: { item: HistoryItem }) {
  return (
    <span className={styles.badge} data-status={item.status}>
      {HISTORY_STATUS_LABEL[item.status]}
    </span>
  );
}

function Detail({ item }: { item: HistoryItem }) {
  const rows: [string, string][] = [
    ["거래번호", item.transactionId],
    ["플랫폼", SOURCE_LABEL[item.source]],
    ["후원 대상", item.creatorName],
    ["상품", item.productLabel],
    ["결제 FN", `${formatNumber(item.fnAmount)} FN`],
    ["거래 상태", HISTORY_STATUS_LABEL[item.status]],
    ["외부 거래번호", item.externalTransactionId ?? "-"],
    ["거래일시", dotted(item.createdAt)],
    ["완료일시", item.completedAt ? dotted(item.completedAt) : "-"],
    ["실패 사유", item.failureReason ?? "해당 없음"]
  ];
  return (
    <>
      <StatusBadge item={item} />
      <dl className={styles.detailList}>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
