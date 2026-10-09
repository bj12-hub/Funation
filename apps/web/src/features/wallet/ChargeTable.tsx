"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { formatNumber } from "@/lib/format";
import { quoteChargeRefund, requestChargeRefund } from "@/services/wallet/refund";
import {
  REFUND_FEE_PERCENT,
  REFUND_KRW_RULE,
  REFUND_METHOD_NOTE,
  REFUND_POLICY_HREF,
  REFUND_POLICY_LABEL,
  REFUND_POLICY_LINES,
  REFUND_PROCESSING_TARGET,
  REFUND_TYPE_LABEL,
  REFUND_WITHDRAWAL_DAYS,
  describeRefund,
  refundChangedNote,
  refundQuoteChangedText,
  type RefundQuote
} from "@/services/wallet/refundPolicy";
import { CHARGE_STATUS_LABEL, REFUND_REASON_MAX, refundStatusText, type ChargeRecord, type ChargeRefund, type ChargeStatus } from "@/services/wallet/walletTypes";
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
                    {c.refund && <span className={styles.refundTag}>{refundStatusText(c.refund)}</span>}
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

const day = (iso: string) => new Date(iso).toLocaleDateString("ko-KR");

/** 환불 정책 요약 — 기본값 (일반적인 기준, 법무 검토 전), with the policy document. */
function RefundPolicy() {
  return (
    <section className={styles.refundPolicy} aria-label="환불 정책">
      <p className={styles.refundPolicyTitle}>
        환불 정책 <span className={styles.refundPolicyBadge}>{REFUND_POLICY_LABEL}</span>
      </p>
      <ul className={styles.refundPolicyList}>
        {REFUND_POLICY_LINES.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Link href={REFUND_POLICY_HREF} className={styles.refundPolicyLink}>
        환불 정책 전문 보기
      </Link>
    </section>
  );
}

/**
 * The server's outcome for this charge, before the member asks: 전액 취소 / 수수료 공제 후 환불 / 환불 불가 + 사유. The
 * KRW amount is the server's too (`refundKrw`: 전액 취소 the whole payment, otherwise its share for the net FN).
 */
function RefundOutcome({ quote }: { quote: RefundQuote }) {
  if (quote.type === "NOT_REFUNDABLE") {
    return (
      <div className={styles.refundOutcome}>
        <strong className={styles.refundOutcomeTitle}>{REFUND_TYPE_LABEL.NOT_REFUNDABLE}</strong>
        <p className={styles.refundNote}>이 충전의 {formatNumber(quote.chargeFn)} FN을 모두 사용했어요. 사용한 FN은 환불되지 않아요.</p>
      </div>
    );
  }
  const full = quote.type === "FULL_CANCEL";
  return (
    <div className={styles.refundOutcome}>
      <strong className={styles.refundOutcomeTitle}>{REFUND_TYPE_LABEL[quote.type]}</strong>
      <p className={styles.refundNote}>
        {full
          ? `결제일로부터 ${REFUND_WITHDRAWAL_DAYS}일 이내이고 이 충전의 FN을 쓰지 않아 수수료 없이 결제가 취소돼요.`
          : quote.usedFn > 0
            ? `이 충전에서 ${formatNumber(quote.usedFn)} FN을 사용해, 남은 FN에서 수수료를 빼고 환불해요.`
            : `결제일로부터 ${REFUND_WITHDRAWAL_DAYS}일이 지나, 남은 FN에서 수수료를 빼고 환불해요.`}
      </p>
      <dl className={styles.refundFacts}>
        <div>
          <dt>{full ? "환불 FN" : "남은 충전 FN"}</dt>
          <dd>{formatNumber(quote.grossFn)} FN</dd>
        </div>
        <div>
          <dt>{full ? "환불 수수료" : `환불 수수료 (${REFUND_FEE_PERCENT})`}</dt>
          <dd>{full ? "없음" : `−${formatNumber(quote.feeFn)} FN`}</dd>
        </div>
        {!full && (
          <div>
            <dt>환불 FN</dt>
            <dd>{formatNumber(quote.netFn)} FN</dd>
          </div>
        )}
        <div>
          <dt>{full ? "결제 취소 금액" : "환불 금액"}</dt>
          <dd className={styles.refundFactsTotal}>{formatNumber(quote.refundKrw)} 원</dd>
        </div>
      </dl>
      {!full && (
        <p className={styles.refundNote}>
          결제 금액 {formatNumber(quote.paidKrw)}원 중 환불 FN만큼 돌려드려요 ({REFUND_KRW_RULE}). {REFUND_METHOD_NOTE}돼요.
        </p>
      )}
    </div>
  );
}

/** A filed request: 접수 · 심사 중 / 승인 / 거절, with the amounts the server stored. */
function RefundStatus({ refund }: { refund: ChargeRefund }) {
  if (refund.status === "REJECTED") {
    return (
      <p className={styles.refundDone} role="status">
        환불 요청이 거절됐어요{refund.note ? ` · 사유: ${refund.note}` : ""}
      </p>
    );
  }
  const approved = refund.status === "APPROVED";
  const changedNote = refund.requestedAmounts ? refundChangedNote(refund.requestedAmounts, refund.amounts) : null;
  return (
    <div className={styles.refundStatus} role="status">
      <p className={styles.refundDone}>
        {approved
          ? `환불이 승인됐어요 · ${formatNumber(refund.amounts.grossFn)} FN이 회수됐어요 (${day(refund.decidedAt ?? refund.requestedAt)})`
          : `환불 요청이 접수됐어요 · 심사 중 (${day(refund.requestedAt)})`}
      </p>
      <p className={styles.refundNote}>
        {approved ? "환불" : "요청 내용"}: {describeRefund(refund.amounts)}
      </p>
      {/* Approval used other amounts than the request: which way, by direction (2026-10-09 결정). */}
      {changedNote && <p className={styles.refundNote}>{changedNote}</p>}
      <p className={styles.refundNote}>{approved ? `원래 결제 수단으로 환불돼요. ${REFUND_METHOD_NOTE}돼요.` : `${REFUND_PROCESSING_TARGET}를 목표로 해요.`}</p>
    </div>
  );
}

/**
 * 환불 요청 (code-first, no Figma frame). Opening the form asks the server for this charge's outcome under the 환불 정책
 * 기본값 (LOADING), shows it with the policy summary, then files the request with the outcome the member saw
 * (PROCESSING → SUCCESS). If FN were used (or came back) in between, the server answers with the new outcome instead
 * (ERROR line, worded by direction).
 */
function RefundSection({ charge }: { charge: ChargeRecord }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [quote, setQuote] = useState<RefundQuote | null>(null);
  // The server's answer bridges the gap until the refreshed record arrives; a repeat request answers
  // with the existing request as it is now, which may already be approved or rejected.
  const [answered, setAnswered] = useState<ChargeRefund | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const refund = charge.refund ?? answered;

  if (refund) return <RefundStatus refund={refund} />;
  if (charge.status !== "COMPLETED") return null;

  const showRequest = (res: ChargeRefund) => {
    setAnswered(res);
    router.refresh();
  };

  const loadQuote = () => {
    setOpen(true);
    setQuote(null);
    setError(null);
    startTransition(async () => {
      try {
        const res = await quoteChargeRefund({ chargeId: charge.id });
        if (res.status === "QUOTE") setQuote(res.quote);
        else if (res.status === "INVALID") setError(res.message);
        else if (res.status === "UNAUTHORIZED") router.push("/login?next=/wallet/charges");
        else showRequest(res);
      } catch {
        setError("환불 금액을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    });
  };

  const submit = () => {
    if (!quote) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await requestChargeRefund({ chargeId: charge.id, reason, expectedGrossFn: quote.grossFn, expectedNetFn: quote.netFn });
        if (res.status === "INVALID") setError(res.message);
        else if (res.status === "UNAUTHORIZED") router.push("/login?next=/wallet/charges");
        else if (res.status === "CHANGED" || res.status === "NOT_REFUNDABLE") {
          setQuote(res.quote);
          // Which way it moved from the quote the member saw (2026-10-09 결정): FN used, or FN that came back.
          setError(refundQuoteChangedText(quote, res.quote));
        } else showRequest(res);
      } catch {
        setError("요청하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    });
  };

  if (!open) {
    return (
      <div className={styles.refund}>
        <button type="button" className={styles.refundButton} onClick={loadQuote}>
          환불 요청
        </button>
      </div>
    );
  }
  const refundable = quote !== null && quote.type !== "NOT_REFUNDABLE";
  return (
    <div className={styles.refund}>
      {quote ? (
        <RefundOutcome quote={quote} />
      ) : (
        pending && (
          <p className={styles.refundNote} role="status">
            환불 금액을 계산하고 있어요…
          </p>
        )
      )}
      {refundable && (
        <>
          <label className={styles.refundLabel} htmlFor={`refund-${charge.id}`}>
            환불 사유 (선택)
          </label>
          <textarea id={`refund-${charge.id}`} className={styles.refundInput} value={reason} maxLength={REFUND_REASON_MAX} onChange={(e) => setReason(e.target.value)} />
        </>
      )}
      <RefundPolicy />
      {error && (
        <p className={styles.refundError} role="alert">
          {error}
        </p>
      )}
      <div className={styles.refundActions}>
        <button type="button" className={styles.modalSecondary} onClick={() => setOpen(false)} disabled={pending}>
          {refundable ? "취소" : "닫기"}
        </button>
        {refundable ? (
          <button type="button" className={styles.modalPrimary} onClick={submit} disabled={pending} aria-busy={pending || undefined}>
            {pending ? "접수 중..." : "환불 요청하기"}
          </button>
        ) : (
          quote === null &&
          !pending && (
            <button type="button" className={styles.modalPrimary} onClick={loadQuote}>
              다시 시도
            </button>
          )
        )}
      </div>
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
