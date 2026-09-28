"use client";

import { useState } from "react";
import { FileIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { formatNumber } from "@/lib/format";
import { CHARGE_STATUS_LABEL, type ChargeRecord, type ChargeStatus } from "@/services/wallet/walletTypes";
import styles from "./wallet.module.css";

const PILL: Record<ChargeStatus, string> = {
  PROCESSING: styles.pillProcessing,
  COMPLETED: styles.pillCompleted,
  CANCELLED: styles.pillCancelled
};

/** Figma 640:2 table (empty 639:2) with the 충전내역 상세정보 popup (643:4 · 644:6 · 644:185 · 644:364). */
export function ChargeTable({ items }: { items: ChargeRecord[] }) {
  const [selected, setSelected] = useState<ChargeRecord | null>(null);

  return (
    <>
      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.chargeTable}`}>
          <thead>
            <tr>
              <th scope="col">날짜와 시간</th>
              <th scope="col">결제수단</th>
              <th scope="col" className={styles.center}>
                충전 FN
              </th>
              <th scope="col" className={styles.center}>
                처리 상태
              </th>
              <th scope="col" className={styles.center}>
                비고
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  충전 내역이 존재하지 않습니다.
                </td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id}>
                  <td className={styles.datetime}>{c.chargedAt}</td>
                  <td className={styles.method}>
                    <span aria-hidden="true">{c.methodEmoji}</span> {c.methodLabel}
                  </td>
                  <td className={styles.center}>
                    <span className={styles.fnChip}>{formatNumber(c.fnAmount)} FN</span>
                  </td>
                  <td className={styles.center}>
                    <span className={`${styles.pill} ${PILL[c.status]}`}>{CHARGE_STATUS_LABEL[c.status]}</span>
                  </td>
                  <td className={styles.center}>
                    <button type="button" className={styles.detailButton} onClick={() => setSelected(c)} aria-label={`${c.chargedAt} 충전 자세히`}>
                      자세히
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="충전내역 상세정보"
        footer={
          <>
            <button type="button" className={styles.modalSecondary} onClick={() => setSelected(null)}>
              닫기
            </button>
            <button type="button" className={styles.modalPrimary} onClick={() => setSelected(null)}>
              확인
            </button>
          </>
        }
      >
        {selected && <ChargeDetail charge={selected} />}
      </Modal>
    </>
  );
}

function ChargeDetail({ charge }: { charge: ChargeRecord }) {
  return (
    <div className={styles.detail}>
      <div className={styles.detailSummary}>
        <div className={styles.detailRow}>
          <span>충전 처리 상태</span>
          <span className={`${styles.pill} ${PILL[charge.status]}`}>{CHARGE_STATUS_LABEL[charge.status]}</span>
        </div>
        <hr className={styles.detailDivider} />
        <div className={styles.detailRow}>
          <span>충전 FN</span>
          <strong className={styles.detailFn}>{formatNumber(charge.fnAmount)} FN</strong>
        </div>
      </div>

      <dl className={styles.detailList}>
        <div>
          <dt>충전 일시</dt>
          <dd>{charge.chargedAt}</dd>
        </div>
        <div>
          <dt>결제 수단</dt>
          <dd>
            <span aria-hidden="true">{charge.methodEmoji}</span> {charge.methodLabel}
            {charge.methodDetail && ` (${charge.methodDetail})`}
          </dd>
        </div>
        <div>
          <dt>결제 금액</dt>
          <dd className={styles.detailPaid}>{formatNumber(charge.paidAmount)} 원</dd>
        </div>
        <div>
          <dt>거래 번호 (TID)</dt>
          <dd className={styles.detailTid}>{charge.transactionId ?? "-"}</dd>
        </div>
      </dl>

      {/* TODO: receipt (매출전표) comes from the payment provider, which is TBD. */}
      <div className={styles.receipt}>
        <FileIcon />
        <span>매출전표 영수증 출력</span>
        <button type="button" className={styles.receiptButton} aria-disabled="true" title="준비 중인 기능입니다">
          확인
        </button>
      </div>
    </div>
  );
}
