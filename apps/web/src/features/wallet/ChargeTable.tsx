"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { FLEXTV_WALLET, FLEXTV_WEB_URL } from "@/lib/flextv/mode";
import { formatKstDate, formatNumber, kstIsoString } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
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
import { REFUND_REASON_MAX, refundStatusText, type ChargeRecord, type ChargeRefund, type ChargeStatus } from "@/services/wallet/walletTypes";
import styles from "./wallet.module.css";

/** FLEXTV's 1:1 문의, where it takes refunds. */
const FLEXTV_REFUND_URL = `${FLEXTV_WEB_URL}/cs/inquiry`;
/** The services' CHARGE_STATUS_LABEL, in the viewer's language. */
const STATUS_KEY: Record<ChargeStatus, MessageKey> = {
  PROCESSING: "wallet.chargeProcessing",
  COMPLETED: "wallet.chargeCompleted",
  CANCELLED: "wallet.chargeCancelled"
};

const PILL: Record<ChargeStatus, string> = {
  PROCESSING: styles.pillProcessing,
  COMPLETED: styles.pillCompleted,
  CANCELLED: styles.pillCancelled
};

/** Figma 640:2 table (empty 639:2) with the 충전내역 상세정보 popup (643:4 · 644:6 · 644:185 · 644:364). */
export function ChargeTable({ items }: { items: ChargeRecord[] }) {
  const { t } = useI18n();
  // Keep the id, not the record: after a refresh the popup shows the server's current state of the charge.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((c) => c.id === selectedId) ?? null;

  return (
    <>
      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.chargeTable}`}>
          <thead>
            <tr>
              <th scope="col">{t("wallet.dateTime")}</th>
              <th scope="col">{t("wallet.paymentMethod")}</th>
              <th scope="col" className={styles.center}>
                {t("wallet.chargedFn")}
              </th>
              <th scope="col" className={styles.center}>
                {t("wallet.status")}
              </th>
              <th scope="col" className={styles.center}>
                {t("wallet.note")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  {t("wallet.noCharges")}
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
                    <span className={`${styles.pill} ${PILL[c.status]}`}>{t(STATUS_KEY[c.status])}</span>
                    {c.refund && <span className={styles.refundTag}>{refundStatusText(c.refund)}</span>}
                  </td>
                  <td className={styles.center}>
                    <button type="button" className={styles.detailButton} onClick={() => setSelectedId(c.id)} aria-label={t("wallet.detailsFor", { at: c.chargedAt })}>
                      {t("wallet.details")}
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
        title={t("wallet.detailTitle")}
        footer={
          <>
            <button type="button" className={styles.modalSecondary} onClick={() => setSelectedId(null)}>
              {t("wallet.close")}
            </button>
            <button type="button" className={styles.modalPrimary} onClick={() => setSelectedId(null)}>
              {t("wallet.ok")}
            </button>
          </>
        }
      >
        {selected && <ChargeDetail charge={selected} />}
      </Modal>
    </>
  );
}

const day = (iso: string) => formatKstDate(iso);
/** 충전 일시's format, "YYYY-MM-DD HH:mm:ss", in Korea time. */
const dateTime = (at: string) => kstIsoString(at).replace("T", " ");

/**
 * 환불 정책 요약 — 기본값 (일반적인 기준, 법무 검토 전), with the policy document. The policy lines are the services' wording
 * and stay Korean until an approved translation exists (TBD); only the heading and the link follow the language.
 */
function RefundPolicy() {
  const { t } = useI18n();
  return (
    <section className={styles.refundPolicy} aria-label={t("wallet.refundPolicy")}>
      <p className={styles.refundPolicyTitle}>
        {t("wallet.refundPolicy")} <span className={styles.refundPolicyBadge}>{REFUND_POLICY_LABEL}</span>
      </p>
      <ul className={styles.refundPolicyList}>
        {REFUND_POLICY_LINES.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Link href={REFUND_POLICY_HREF} className={styles.refundPolicyLink}>
        {t("wallet.refundPolicyFull")}
      </Link>
    </section>
  );
}

/**
 * The server's outcome for this charge, before the member asks: 전액 취소 / 수수료 공제 후 환불 / 환불 불가 + 사유. The
 * KRW amount is the server's too (`refundKrw`: 전액 취소 the whole payment, otherwise its share for the net FN).
 * The explanation lines are refund-policy wording: they stay Korean until an approved translation exists (TBD).
 */
function RefundOutcome({ quote }: { quote: RefundQuote }) {
  const { t } = useI18n();
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
          <dt>{full ? t("wallet.refundFn") : t("wallet.remainingFn")}</dt>
          <dd>{formatNumber(quote.grossFn)} FN</dd>
        </div>
        <div>
          <dt>{full ? t("wallet.refundFee") : t("wallet.refundFeeRate", { rate: REFUND_FEE_PERCENT })}</dt>
          <dd>{full ? t("wallet.none") : `−${formatNumber(quote.feeFn)} FN`}</dd>
        </div>
        {!full && (
          <div>
            <dt>{t("wallet.refundFn")}</dt>
            <dd>{formatNumber(quote.netFn)} FN</dd>
          </div>
        )}
        <div>
          <dt>{full ? t("wallet.cancelAmount") : t("wallet.refundAmount")}</dt>
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
  const { t } = useI18n();
  if (refund.status === "REJECTED") {
    return (
      <p className={styles.refundDone} role="status">
        {refund.note ? t("wallet.refundRejectedReason", { reason: refund.note }) : t("wallet.refundRejected")}
      </p>
    );
  }
  const approved = refund.status === "APPROVED";
  const changedNote = refund.requestedAmounts ? refundChangedNote(refund.requestedAmounts, refund.amounts) : null;
  return (
    <div className={styles.refundStatus} role="status">
      <p className={styles.refundDone}>
        {approved
          ? t("wallet.refundApproved", { fn: formatNumber(refund.amounts.grossFn), date: day(refund.decidedAt ?? refund.requestedAt) })
          : t("wallet.refundRequested", { date: day(refund.requestedAt) })}
      </p>
      <p className={styles.refundNote}>
        {approved ? t("wallet.refundLabel") : t("wallet.requestLabel")}: {describeRefund(refund.amounts)}
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
  const { t } = useI18n();
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
        setError(t("wallet.quoteFailed"));
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
        setError(t("wallet.requestFailed"));
      }
    });
  };

  if (!open) {
    return (
      <div className={styles.refund}>
        <button type="button" className={styles.refundButton} onClick={loadQuote}>
          {t("wallet.requestRefund")}
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
            {t("wallet.calculating")}
          </p>
        )
      )}
      {refundable && (
        <>
          <label className={styles.refundLabel} htmlFor={`refund-${charge.id}`}>
            {t("wallet.refundReason")}
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
          {refundable ? t("wallet.cancel") : t("wallet.close")}
        </button>
        {refundable ? (
          <button type="button" className={styles.modalPrimary} onClick={submit} disabled={pending} aria-busy={pending || undefined}>
            {pending ? t("wallet.submitting") : t("wallet.submitRefund")}
          </button>
        ) : (
          quote === null &&
          !pending && (
            <button type="button" className={styles.modalPrimary} onClick={loadQuote}>
              {t("wallet.retry")}
            </button>
          )
        )}
      </div>
    </div>
  );
}

/**
 * The 상세정보 popup's body. 결제 확인 일시 (code-first, 2026-10-13): only a 처리중 charge confirmed later has one
 * (`confirmedAt`, from the server) — its 7-day 청약철회 period counts from there, not from 충전 일시.
 */
export function ChargeDetail({ charge }: { charge: ChargeRecord }) {
  const { t } = useI18n();
  return (
    <div className={styles.detail}>
      <div className={styles.detailSummary}>
        <div className={styles.detailRow}>
          <span>{t("wallet.chargeStatus")}</span>
          <span className={`${styles.pill} ${PILL[charge.status]}`}>{t(STATUS_KEY[charge.status])}</span>
        </div>
        <hr className={styles.detailDivider} />
        <div className={styles.detailRow}>
          <span>{t("wallet.chargedFn")}</span>
          <strong className={styles.detailFn}>{formatNumber(charge.fnAmount)} FN</strong>
        </div>
      </div>

      <dl className={styles.detailList}>
        <div>
          <dt>{t("wallet.chargedAt")}</dt>
          <dd>{charge.chargedAt}</dd>
        </div>
        {charge.confirmedAt && (
          <div>
            <dt>{t("wallet.confirmedAt")}</dt>
            <dd>{dateTime(charge.confirmedAt)}</dd>
          </div>
        )}
        <div>
          <dt>{t("wallet.method")}</dt>
          <dd>
            <span aria-hidden="true">{charge.methodEmoji}</span> {charge.methodLabel}
            {charge.methodDetail && ` (${charge.methodDetail})`}
          </dd>
        </div>
        <div>
          <dt>{t("wallet.paidAmount")}</dt>
          <dd className={styles.detailPaid}>{formatNumber(charge.paidAmount)} 원</dd>
        </div>
        <div>
          <dt>{t("wallet.transactionId")}</dt>
          <dd className={styles.detailTid}>{charge.transactionId ?? "-"}</dd>
        </div>
      </dl>

      {FLEXTV_WALLET ? (
        // FLEXTV takes refunds through its 1:1 문의 and has no refund API yet (docs/development/flextv-backend.md).
        <div className={styles.refund}>
          <p className={styles.refundNote}>
            {t("wallet.flextvRefund")}{" "}
            <a href={FLEXTV_REFUND_URL} target="_blank" rel="noopener noreferrer">
              {t("wallet.flextvInquiry")}
            </a>
          </p>
        </div>
      ) : (
        <RefundSection charge={charge} />
      )}

      {/* TODO: receipt (매출전표) comes from the payment provider, which is TBD. */}
      <div className={styles.receipt}>
        <FileIcon />
        <span>{t("wallet.receipt")}</span>
        <button type="button" className={styles.receiptButton} aria-disabled="true" title={t("common.comingSoon")}>
          {t("wallet.receiptView")}
        </button>
      </div>
    </div>
  );
}
