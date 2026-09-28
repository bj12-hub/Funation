import Link from "next/link";
import { formatNumber } from "@/lib/format";
import { DONATION_STATUS_LABEL, type DonationRecord, type DonationStatus } from "@/services/wallet/walletTypes";
import styles from "./wallet.module.css";

const STATUS_TONE: Record<DonationStatus, string> = {
  COMPLETED: styles.statusCompleted,
  PROCESSING: styles.statusProcessing,
  FAILED: styles.statusFailed,
  REFUNDING: styles.statusProcessing,
  REFUNDED: styles.statusMuted
};

/** Figma 632:4 후원내역 table (empty 637:214). */
export function DonationTable({ items }: { items: DonationRecord[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${styles.donationTable}`}>
        <thead>
          <tr>
            <th scope="col">날짜와 시간</th>
            <th scope="col">크리에이터</th>
            <th scope="col">후원 내용</th>
            <th scope="col" className={styles.right}>
              사용 FN 금액
            </th>
            <th scope="col" className={styles.center}>
              후원 유형
            </th>
            <th scope="col" className={styles.center}>
              처리 상태
            </th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={6} className={styles.empty}>
                후원 내역이 존재하지 않습니다.
              </td>
            </tr>
          ) : (
            items.map((d) => (
              <tr key={d.id}>
                <td className={styles.datetimeMuted}>{d.donatedAt}</td>
                <td>
                  <Link href={`/creators/${d.creatorId}`} className={styles.creator}>
                    {d.creatorName}
                  </Link>
                </td>
                <td className={styles.message} title={d.message}>
                  {d.message}
                </td>
                <td className={`${styles.right} ${styles.usedFn}`}>{formatNumber(d.fnAmount)} FN</td>
                <td className={styles.center}>
                  <span className={styles.typeChip}>{d.typeLabel}</span>
                </td>
                <td className={`${styles.center} ${STATUS_TONE[d.status]}`}>{DONATION_STATUS_LABEL[d.status]}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
