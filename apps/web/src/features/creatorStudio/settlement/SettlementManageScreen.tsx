import Link from "next/link";
import { memberTypeLabel, SETTLEMENT_STATUS_LABEL, type SettlementManageView } from "@/services/creator/settlementTypes";
import { ChangeInfoButton, ManageFilter } from "./ManageControls";
import { SettlementTabs } from "./SettlementTabs";
import applyStyles from "./apply.module.css";
import styles from "./manage.module.css";

const fn = (n: number) => n.toLocaleString("ko-KR");
const short = (iso: string) => iso.slice(5);

/** Figma 478:2 · 479:144 — 정산 관리 (route `/creator/settlement/manage`). */
export function SettlementManageScreen({ view }: { view: SettlementManageView }) {
  const qs = (page: number) => {
    const p = new URLSearchParams({ period: view.period, page: String(page) });
    if (view.period === "custom") {
      p.set("from", view.from);
      p.set("to", view.to);
    }
    return `/creator/settlement/manage?${p}`;
  };

  return (
    <div className={applyStyles.content}>
      <SettlementTabs active="manage" />
      <h1 className={applyStyles.pageTitle}>정산 관리</h1>

      <section className={styles.infoCard} aria-label="정산 등록 정보">
        <dl className={styles.info}>
          <div>
            <dt>정산 등록자</dt>
            <dd>{view.registrant}</dd>
          </div>
          <div>
            <dt>정산 계좌</dt>
            <dd>
              {view.bankName} {view.accountMasked}
            </dd>
          </div>
          <div>
            <dt>정산 유형</dt>
            <dd>{memberTypeLabel(view.memberType)}</dd>
          </div>
        </dl>
        <ChangeInfoButton />
      </section>

      <ManageFilter key={`${view.period}-${view.from}-${view.to}`} period={view.period} from={view.from} to={view.to} />

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">상태</th>
              <th scope="col">신청일</th>
              <th scope="col">정산 기간</th>
              <th scope="col">신청 금액</th>
              <th scope="col">수수료</th>
              <th scope="col">정산 금액</th>
              <th scope="col">지급(예정)일</th>
            </tr>
          </thead>
          <tbody>
            {view.items.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.empty}>
                  조회된 정산 내역이 없습니다.
                </td>
              </tr>
            ) : (
              view.items.map((r) => {
                const rejected = r.status === "REJECTED" || r.status === "FORFEITED";
                return (
                  <tr key={r.id}>
                    <td>
                      <span className={applyStyles.badge} data-status={r.status}>
                        {SETTLEMENT_STATUS_LABEL[r.status]}
                      </span>
                      {r.reviewNote && <p className={styles.reviewNote}>사유: {r.reviewNote}</p>}
                    </td>
                    <td>{r.requestedAt}</td>
                    <td>
                      {r.periodFrom} ~ {short(r.periodTo)}
                    </td>
                    <td>{fn(r.amountFn)} FN</td>
                    <td className={rejected ? undefined : styles.fee}>{rejected ? "-" : `-${fn(r.feeFn)}`}</td>
                    <td className={styles.net}>{rejected ? "-" : `${fn(r.netKrw)} 원`}</td>
                    <td>{r.payoutDate ?? "-"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <nav className={styles.pagination} aria-label="페이지">
        {view.page > 1 ? (
          <Link href={qs(view.page - 1)} className={styles.pageButton} aria-label="이전 페이지">
            ‹
          </Link>
        ) : (
          <span className={styles.pageButton} aria-disabled="true">
            ‹
          </span>
        )}
        {Array.from({ length: view.totalPages }, (_, i) => i + 1).map((n) => (
          <Link key={n} href={qs(n)} className={styles.pageButton} aria-current={n === view.page ? "page" : undefined}>
            {n}
          </Link>
        ))}
        {view.page < view.totalPages ? (
          <Link href={qs(view.page + 1)} className={styles.pageButton} aria-label="다음 페이지">
            ›
          </Link>
        ) : (
          <span className={styles.pageButton} aria-disabled="true">
            ›
          </span>
        )}
      </nav>
    </div>
  );
}
