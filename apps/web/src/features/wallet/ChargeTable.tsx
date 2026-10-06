"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { formatNumber } from "@/lib/format";
import { requestChargeRefund } from "@/services/wallet/refund";
import { CHARGE_STATUS_LABEL, REFUND_REASON_MAX, REFUND_STATUS_LABEL, type ChargeRecord, type ChargeRefund, type ChargeStatus } from "@/services/wallet/walletTypes";
import styles from "./wallet.module.css";

const PILL: Record<ChargeStatus, string> = {
  PROCESSING: styles.pillProcessing,
  COMPLETED: styles.pillCompleted,
  CANCELLED: styles.pillCancelled
};

/** Figma 640:2 table (empty 639:2) with the 충전내역 상세정보 popup (643:4 · 644:6 · 644:185 · 644:364). */
export function ChargeTable({ items }: { items: ChargeRecord[] }) {
  // Keep the id, not the record: after a refresh the popup shows the server's current state of the charge.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((c) => c.id === selectedId) ?? null;

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
                    {c.refund && <span className={styles.refundTag}>{REFUND_STATUS_LABEL[c.refund.status]}</span>}
                  </td>
                  <td className={styles.center}>
                    <button type="button" className={styles.detailButton} onClick={() => setSelectedId(c.id)} aria-label={`${c.chargedAt} 충전 자세히`}>
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
        onClose={() => setSelectedId(null)}
        title="충전내역 상세정보"
        footer={
          <>
            <button type="button" className={styles.modalSecondary} onClick={() => setSelectedId(null)}>
              닫기
            </button>
            <button type="button" className={styles.modalPrimary} onClick={() => setSelectedId(null)}>
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

/**
 * 환불 요청 (code-first, no Figma frame). Only records the request — the refund policy and review
 * are TBD, so the copy promises nothing about eligibility or timing.
 */
function RefundSection({ charge }: { charge: ChargeRecord }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  // The server's answer bridges the gap until the refreshed record arrives; a repeat request answers
  // with the existing request as it is now, which may already be approved or rejected.
  const [answered, setAnswered] = useState<ChargeRefund | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const refund = charge.refund ?? answered;

  if (refund?.status === "APPROVED") {
    return (
      <p className={styles.refundDone} role="status">
        환불이 승인됐어요 · FN이 회수됐어요 ({new Date(refund.decidedAt ?? refund.requestedAt).toLocaleDateString("ko-KR")}). 결제 취소 처리 시점은 결제 수단에 따라 달라요 (TBD).
      </p>
    );
  }
  if (refund?.status === "REJECTED") {
    return (
      <p className={styles.refundDone} role="status">
        환불 요청이 거절됐어요{refund.note ? ` · 사유: ${refund.note}` : ""}
      </p>
    );
  }
  if (refund) {
    return (
      <p className={styles.refundDone} role="status">
        환불 요청이 접수됐어요 · 심사 중 ({new Date(refund.requestedAt).toLocaleDateString("ko-KR")})
      </p>
    );
  }
  if (charge.status !== "COMPLETED") return null;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await requestChargeRefund({ chargeId: charge.id, reason });
      if (res.status === "INVALID") setError(res.message);
      else if (res.status === "UNAUTHORIZED") router.push("/login?next=/wallet/charges");
      else {
        setAnswered(res);
        router.refresh();
      }
    });
  };

  return (
    <div className={styles.refund}>
      {!open ? (
        <button type="button" className={styles.refundButton} onClick={() => setOpen(true)}>
          환불 요청
        </button>
      ) : (
        <>
          <label className={styles.refundLabel} htmlFor={`refund-${charge.id}`}>
            환불 사유 (선택)
          </label>
          <textarea id={`refund-${charge.id}`} className={styles.refundInput} value={reason} maxLength={REFUND_REASON_MAX} onChange={(e) => setReason(e.target.value)} />
          <p className={styles.refundNote}>환불 가능 여부와 처리 기간은 정책이 확정된 뒤 안내돼요(TBD). 요청은 접수 후 검토돼요.</p>
          {error && (
            <p className={styles.refundError} role="alert">
              {error}
            </p>
          )}
          <div className={styles.refundActions}>
            <button type="button" className={styles.modalSecondary} onClick={() => setOpen(false)} disabled={pending}>
              취소
            </button>
            <button type="button" className={styles.modalPrimary} onClick={submit} disabled={pending} aria-busy={pending || undefined}>
              {pending ? "접수 중..." : "환불 요청하기"}
            </button>
          </div>
        </>
      )}
    </div>
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

      <RefundSection charge={charge} />

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
