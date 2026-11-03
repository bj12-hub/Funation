"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { requestExchange } from "@/services/creator/flextvSettlement";
import type { ExchangeRequestResult, FlextvSettlementView } from "@/services/creator/flextvSettlementTypes";
import { keyForQuote } from "./settlementSubmit";
import styles from "./flextv.module.css";

type Step = "request" | "confirm" | "done";

/**
 * 정산 신청 with FLEXTV: 렉스 → 확인 → 완료. The server checks FLEXTV's rules again and FLEXTV sets the payout. A lost or
 * unclear answer keeps the amount and its Idempotency-Key, so 확인 again asks about the same request (settlementSubmit.ts).
 */
export function FlextvExchangeForm({ view }: { view: FlextvSettlementView }) {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("request");
  const [input, setInput] = useState("");
  const [business, setBusiness] = useState(false);
  const [key, setKey] = useState<{ key: string | null; amountFn: number | null }>({ key: null, amountFn: null });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const amount = Number(input);
  // The request hours and the minimum are FLEXTV's schedule and minimum (policy wording): Korean in both languages.
  const blocked = !view.identityVerified ? t("flextvSettlement.blockedIdentity") : !view.account ? t("flextvSettlement.blockedAccount") : view.openRequest ? t("flextvSettlement.blockedOpenRequest") : !view.open ? `${t("flextvSettlement.blockedClosed")} 매일 0시 1분부터 오후 2시 전까지 신청할 수 있어요.` : null;

  const toConfirm = () => {
    setError(null);
    if (!Number.isSafeInteger(amount) || amount <= 0) return setError(t("flextvSettlement.amountInvalid"));
    if (amount < view.minRex) return setError(`${formatNumber(view.minRex)} 렉스부터 정산 신청할 수 있어요.`);
    if (amount > view.exchangeable) return setError(t("flextvSettlement.overAvailable"));
    // The same amount keeps the key of a 확인 whose answer was lost.
    setKey((last) => ({ key: keyForQuote(last, amount, () => crypto.randomUUID()), amountFn: amount }));
    setStep("confirm");
  };

  const onAnswer = (r: ExchangeRequestResult) => {
    if (r.status === "REQUESTED") {
      setKey({ key: null, amountFn: null });
      setStep("done");
      router.refresh();
    } else if (r.status === "IN_PROGRESS") setError(t("studioSettlementApply.submitUnknown"));
    else if (r.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/settlement/apply");
    else if (r.status === "IDENTITY_REQUIRED" || r.status === "NO_ACCOUNT") router.push("/creator/settlement");
    else {
      setKey({ key: null, amountFn: null });
      setStep("request");
      setError(r.status === "INVALID" ? r.message : t("flextvSettlement.conflict"));
    }
  };

  const submit = () => {
    if (!key.key) return;
    setError(null);
    const idempotencyKey = key.key;
    startTransition(async () => {
      try {
        onAnswer(await requestExchange({ amount, business, idempotencyKey }));
      } catch {
        setError(t("studioSettlementApply.submitUnknown"));
      }
    });
  };

  if (step === "done") {
    return (
      <section className={styles.card} aria-labelledby="fx-done">
        <h2 id="fx-done" className={styles.cardTitle}>
          {t("flextvSettlement.doneTitle")}
        </h2>
        <p className={styles.help}>{t("flextvSettlement.doneText", { amount: formatNumber(amount) })}</p>
        <div className={styles.actions}>
          <Link href="/creator/settlement/manage" className={styles.primaryButton}>
            {t("flextvSettlement.goManage")}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.card} aria-labelledby="fx-form">
      <h2 id="fx-form" className={styles.cardTitle}>
        {step === "confirm" ? t("flextvSettlement.confirmTitle") : t("flextvSettlement.requestTitle")}
      </h2>
      {blocked ? (
        <p className={styles.help}>{blocked}</p>
      ) : step === "request" ? (
        <form
          className={styles.field}
          onSubmit={(e) => {
            e.preventDefault();
            toConfirm();
          }}
        >
          {view.business && (
            <fieldset className={styles.field}>
              <legend className={styles.label}>{t("flextvSettlement.kind")}</legend>
              <div className={styles.radios}>
                <label className={styles.check}>
                  <input type="radio" name="kind" checked={!business} onChange={() => setBusiness(false)} />
                  {t("flextvSettlement.individual")}
                </label>
                <label className={styles.check}>
                  <input type="radio" name="kind" checked={business} onChange={() => setBusiness(true)} />
                  {/* The 사업자 schedule is policy wording: Korean in both languages. */}
                  {t("flextvSettlement.business")} (매주 수요일 오후 2시 전)
                </label>
              </div>
            </fieldset>
          )}
          <label className={styles.label} htmlFor="fx-amount">
            {t("flextvSettlement.amountLabel")}
          </label>
          <div className={styles.amountRow}>
            <input
              id="fx-amount"
              className={styles.input}
              inputMode="numeric"
              value={input}
              onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 12))}
              placeholder={`${formatNumber(view.minRex)} 이상`}
              aria-describedby="fx-amount-help"
            />
            <button type="button" className={styles.secondaryButton} onClick={() => setInput(String(view.exchangeable))} disabled={view.exchangeable < view.minRex}>
              {t("flextvSettlement.fullAmount")}
            </button>
            <button type="submit" className={styles.primaryButton} disabled={!input}>
              {t("flextvSettlement.next")}
            </button>
          </div>
          {/* The minimum is policy wording: Korean in both languages. */}
          <p id="fx-amount-help" className={styles.note}>
            {t("flextvSettlement.available", { amount: formatNumber(view.exchangeable) })} · {formatNumber(view.minRex)} 렉스부터 신청할 수 있어요. {t("flextvSettlement.oneAtATime")}
          </p>
        </form>
      ) : (
        <>
          <dl className={styles.confirm}>
            <dt>{t("flextvSettlement.requestedRex")}</dt>
            <dd>{formatNumber(amount)} 렉스</dd>
            <dt>{t("flextvSettlement.kind")}</dt>
            <dd>{business ? t("flextvSettlement.business") : t("flextvSettlement.individual")}</dd>
            <dt>{t("flextvSettlement.depositAccount")}</dt>
            <dd>
              {view.account!.bankName} {view.account!.accountMasked} ({view.account!.holder})
            </dd>
          </dl>
          {/* The payout line (contract rate, withholding tax) is policy wording: Korean in both languages. */}
          <p className={styles.note}>지급액은 FLEXTV가 계약 요율과 세금(원천징수)을 적용해 정하고, 신청 후 정산 관리에서 확인할 수 있어요.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} disabled={pending} onClick={() => (setError(null), setStep("request"))}>
              {t("flextvSettlement.cancel")}
            </button>
            <button type="button" className={styles.primaryButton} disabled={pending} aria-busy={pending || undefined} onClick={submit}>
              {pending ? t("flextvSettlement.requesting") : t("flextvSettlement.confirm")}
            </button>
          </div>
        </>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
