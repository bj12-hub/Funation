"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HelpCircleIcon, AlertCircleIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { quoteSettlement, requestSettlement, setAutoSettlement } from "@/services/creator/settlementRequests";
import type { SettlementApplyView, SettlementGate, SettlementQuote } from "@/services/creator/settlementTypes";
import { FeeGuideModal, SettlementGuideModal } from "./SettlementInfoPopups";
import { SUBMIT_CONFLICT_MESSAGE, SUBMIT_UNKNOWN_MESSAGE, afterSubmit, askServer, keyForQuote } from "./settlementSubmit";
import styles from "./apply.module.css";

const fn = (n: number) => n.toLocaleString("ko-KR");
const pct = (rate: number) => `${Math.round(rate * 1000) / 10}%`;

type Step = "request" | "confirm" | "complete" | null;

/** The flow's own messages (settlementSubmit.ts) in the viewer's language; the server's messages show as written. */
const SUBMIT_MESSAGE_KEY: Record<string, MessageKey> = {
  [SUBMIT_UNKNOWN_MESSAGE]: "studioSettlementApply.submitUnknown",
  [SUBMIT_CONFLICT_MESSAGE]: "studioSettlementApply.submitConflict"
};

/**
 * 신청 가능 FN card (458:70) and the request flow: 정산 신청 (469:195 · 469:2) → 정산 신청 확인 (473:2)
 * → 완료 (477:2), plus 정산 관련 안내 (466:2) and 수수료 안내 (475:2). All amounts and fees come from
 * the server; the browser only parses the typed number and formats server values.
 */
export function SettlementRequestFlow({ view }: { view: SettlementApplyView }) {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<Step>(null);
  const [guide, setGuide] = useState(false);
  const [feeGuide, setFeeGuide] = useState(false);
  const [mode, setMode] = useState<"all" | "part">("part");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<SettlementQuote | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [auto, setAuto] = useState(view.autoSettlement);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const belowMin = view.minFn !== null && view.availableFn < view.minFn;
  const errorText = error && SUBMIT_MESSAGE_KEY[error] ? t(SUBMIT_MESSAGE_KEY[error]) : error;
  const amount = mode === "all" ? view.availableFn : Number(input.replace(/,/g, ""));

  const handleResult = (status: "UNAUTHORIZED" | SettlementGate) => {
    if (status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/settlement/apply");
    // 본인인증 missing (e.g. reset after this page loaded): the settlement home opens the 본인인증 notice.
    else if (status === "IDENTITY_REQUIRED") router.push("/creator/settlement?gate=identity");
    else router.push("/creator/settlement");
  };

  const openRequest = () => {
    setMode("part");
    setInput("");
    setError(null);
    setStep("request");
  };

  const toConfirm = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await quoteSettlement(amount);
        if (res.status === "OK") {
          // The same amount keeps the key of a 확인 whose answer was lost (settlementSubmit.ts `keyForQuote`).
          setIdempotencyKey(keyForQuote({ key: idempotencyKey, amountFn: quote?.amountFn ?? null }, res.quote.amountFn, () => crypto.randomUUID()));
          setQuote(res.quote);
          setStep("confirm");
        } else if (res.status === "INVALID") setError(res.message);
        else handleResult(res.status);
      } catch {
        setError(t("studioSettlementApply.quoteFailed"));
      }
    });
  };

  const submit = () => {
    if (!quote || !idempotencyKey) return;
    setError(null);
    startTransition(async () => {
      // A lost answer keeps the quote and the key (settlementSubmit.ts): 확인 again cannot make a second request.
      const next = afterSubmit(await askServer(() => requestSettlement({ amountFn: quote.amountFn, idempotencyKey })));
      if ("leave" in next) return handleResult(next.leave);
      if (next.step === "complete") setQuote(next.quote);
      else setError(next.error);
      // Back to the amount: this request is settled, the next quote is a new one.
      if (next.step === "request") setIdempotencyKey(null);
      setStep(next.step);
    });
  };

  const finish = () => {
    setStep(null);
    setQuote(null);
    setIdempotencyKey(null);
    router.refresh();
  };

  const toggleAuto = (on: boolean) => {
    if (on === auto) return;
    setAutoError(null);
    setAuto(on);
    startTransition(async () => {
      const res = await setAutoSettlement(on).catch(() => ({ status: "INVALID" }) as const);
      if (res.status !== "SAVED") {
        setAuto(!on);
        if (res.status === "INVALID") setAutoError(t("studioSettlementApply.saveFailed"));
        else handleResult(res.status);
      }
    });
  };

  return (
    <>
      <section className={styles.cashCard} aria-labelledby="cash-label">
        <div className={styles.cashHead}>
          <span id="cash-label" className={styles.cashLabel}>
            {t("studioSettlementApply.availableFn")}
          </span>
          <strong className={styles.cashValue}>{fn(view.availableFn)} FN &gt;</strong>
        </div>
        <button type="button" className={styles.cashButton} onClick={openRequest} disabled={belowMin} title={belowMin ? t("studioSettlementApply.belowMin") : undefined}>
          {t("studioSettlementApply.request")}
        </button>
        {view.hasPending ? (
          <button type="button" className={`${styles.infoBar} ${styles.pendingBar}`} onClick={() => setGuide(true)}>
            <AlertCircleIcon className={styles.barIcon} aria-hidden="true" />
            {t("studioSettlementApply.pendingBar")}
          </button>
        ) : (
          <button type="button" className={styles.infoBar} onClick={() => setGuide(true)}>
            <AlertCircleIcon className={styles.barIcon} aria-hidden="true" />
            {t("studioSettlementApply.readFirst")}
          </button>
        )}
        <div className={styles.autoRow}>
          <span className={styles.autoLabel}>
            {t("studioSettlementApply.auto")}
            <button type="button" className={styles.helpButton} onClick={() => setGuide(true)} aria-label={t("studioSettlementApply.autoGuide")}>
              <HelpCircleIcon />
            </button>
          </span>
          <span className={styles.toggle} role="group" aria-label={t("studioSettlementApply.auto")}>
            {[true, false].map((on) => (
              <button key={String(on)} type="button" aria-pressed={auto === on} onClick={() => toggleAuto(on)} disabled={pending}>
                {on ? "ON" : "OFF"}
              </button>
            ))}
          </span>
        </div>
        {autoError && (
          <p className={styles.cashError} role="alert">
            {autoError}
          </p>
        )}
      </section>

      {/* 469:195 · 469:2 */}
      <Modal
        open={step === "request"}
        onClose={() => setStep(null)}
        title={t("studioSettlementApply.request")}
        width={480}
        className={styles.popup}
        footer={
          <>
            <button type="button" className={styles.greyButton} onClick={() => setStep(null)}>
              {t("studioSettlementApply.back")}
            </button>
            <button type="button" className={styles.blueButton} onClick={toConfirm} disabled={pending || !(amount > 0)} aria-busy={pending || undefined}>
              {pending ? t("studioSettlementApply.checking") : t("studioSettlementApply.request")}
            </button>
          </>
        }
      >
        <div className={styles.popupBox}>
          <p className={styles.boxTitle}>{t("studioSettlementApply.payoutAccount")}</p>
          <p className={styles.boxText}>
            {view.bankName} {view.accountMasked}
            <br />
            {view.holder}
          </p>
          <hr className={styles.boxDivider} />
          <p className={styles.boxLabel}>{t("studioSettlementApply.availableFn")}</p>
          <div className={styles.boxRow}>
            <strong className={styles.boxAmount}>{fn(view.availableFn)} FN</strong>
            <button type="button" className={styles.smallButton} onClick={() => setFeeGuide(true)}>
              {t("studioSettlementApply.details")}
            </button>
          </div>
        </div>
        <div className={styles.segment} role="group" aria-label={t("studioSettlementApply.modeAria")}>
          {(["all", "part"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
            >
              {m === "all" ? t("studioSettlementApply.modeAll") : t("studioSettlementApply.modePart")}
            </button>
          ))}
        </div>
        <div className={styles.amountField}>
          <label htmlFor="settle-amount" className={styles.amountLabel}>
            {t("studioSettlementApply.amountLabel")}
          </label>
          <span className={styles.amountInputWrap}>
            <input
              id="settle-amount"
              className={styles.amountInput}
              inputMode="numeric"
              placeholder={t("studioSettlementApply.amountPlaceholder")}
              value={mode === "all" ? fn(view.availableFn) : input}
              readOnly={mode === "all"}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
                setInput(digits ? fn(Number(digits)) : "");
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby="settle-amount-help"
            />
            <span className={styles.amountSuffix}>FN</span>
          </span>
          <p id="settle-amount-help" className={styles.amountHelp} role={error ? "alert" : undefined}>
            {errorText ?? (view.minFn !== null && !input && mode === "part" ? `* ${fn(view.minFn)} FN 이상 정산신청 가능합니다.` : "")}
          </p>
        </div>
      </Modal>

      {/* 473:2 */}
      <Modal
        open={step === "confirm"}
        onClose={() => setStep(null)}
        title={t("studioSettlementApply.confirmTitle")}
        width={440}
        className={styles.popup}
        footer={
          <>
            <button type="button" className={styles.greyButton} onClick={() => setStep("request")} disabled={pending}>
              {t("studioSettlementApply.cancel")}
            </button>
            <button type="button" className={styles.blueButton} onClick={submit} disabled={pending} aria-busy={pending || undefined}>
              {pending ? t("studioSettlementApply.requesting") : t("studioSettlementApply.confirm")}
            </button>
          </>
        }
      >
        {quote && (
          <div className={styles.confirm}>
            <p className={styles.confirmRow}>
              <span>{t("studioSettlementApply.requestedAmount")}</span>
              <strong>{fn(quote.amountFn)} FN</strong>
            </p>
            <div className={styles.popupBox}>
              <p className={styles.boxTitle}>
                {t("studioSettlementApply.feeTitle")}
                <button type="button" className={styles.helpButton} onClick={() => setFeeGuide(true)} aria-label={t("studioSettlementApply.feeGuideAria")}>
                  <HelpCircleIcon />
                </button>
              </p>
              <p className={styles.feeRow}>
                <span>{t("studioSettlementApply.paymentFee", { rate: pct(quote.paymentFeeRate) })}</span>
                <span>- {fn(quote.paymentFeeFn)} FN</span>
              </p>
              <p className={styles.feeRow}>
                <span>{t("studioSettlementApply.serviceFee", { rate: pct(quote.serviceFeeRate) })}</span>
                <span>- {fn(quote.serviceFeeFn)} FN</span>
              </p>
              <hr className={styles.boxDivider} />
              <p className={`${styles.feeRow} ${styles.feeTotal}`}>
                <span>{t("studioSettlementApply.totalFee")}</span>
                <span>- {fn(quote.totalFeeFn)} FN</span>
              </p>
            </div>
            <p className={styles.netRow}>
              <span>{t("studioSettlementApply.netAmount")}</span>
              <strong>{fn(quote.netKrw)} 원</strong>
            </p>
            <p className={styles.confirmAsk}>{t("studioSettlementApply.confirmAsk")}</p>
            {errorText && (
              <p className={styles.cashError} role="alert">
                {errorText}
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* 477:2 */}
      <Modal
        open={step === "complete"}
        onClose={finish}
        title={t("studioSettlementApply.doneTitle")}
        width={420}
        className={styles.popup}
        customHeader={
          <div className={styles.doneHead}>
            <span className={styles.doneMark} aria-hidden="true">
              ✓
            </span>
            <h2 className={styles.doneTitle}>{t("studioSettlementApply.doneTitle")}</h2>
            <p className={styles.doneText}>승인 완료까지 최대 2~3 영업일이 소요될 수 있습니다.</p>
          </div>
        }
        footer={
          <button type="button" className={styles.blueButton} onClick={finish}>
            {t("studioSettlementApply.ok")}
          </button>
        }
      >
        {quote && (
          <>
            <div className={styles.popupBox}>
              <p className={styles.feeRow}>
                <span>{t("studioSettlementApply.doneAmount")}</span>
                <strong>{fn(quote.amountFn)} FN</strong>
              </p>
              <p className={`${styles.feeRow} ${styles.feeTotal}`}>
                <span>{t("studioSettlementApply.doneFee")}</span>
                <span>- {fn(quote.totalFeeFn)} FN</span>
              </p>
              <hr className={styles.boxDivider} />
              <p className={`${styles.feeRow} ${styles.doneNet}`}>
                <span>{t("studioSettlementApply.netAmount")}</span>
                <strong>{fn(quote.netKrw)} 원</strong>
              </p>
            </div>
            <p className={styles.doneNote}>{t("studioSettlementApply.doneNote")}</p>
          </>
        )}
      </Modal>

      <SettlementGuideModal open={guide} onClose={() => setGuide(false)} minFn={view.minFn} />
      <FeeGuideModal open={feeGuide} onClose={() => setFeeGuide(false)} />
    </>
  );
}
