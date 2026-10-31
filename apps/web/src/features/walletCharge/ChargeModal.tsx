"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertCircleIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { FLEXTV_WALLET } from "@/lib/flextv/mode";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { agreeChargeTerms, getChargeOptions, quoteCharge, requestCharge } from "@/services/wallet/charge";
import {
  CHARGE_ERRORS,
  PAYMENT_METHODS,
  WINDOW_PAYMENT_METHODS,
  type ChargeAmountInput,
  type ChargeErrorCode,
  type ChargeOptions,
  type ChargeResult,
  type PaymentMethodId
} from "@/services/wallet/chargeTypes";
import { DepositRequestedView, EligibilityNotice, PaymentWindowView, depositBonusOf } from "./FlextvChargeViews";
import { MethodCards } from "./MethodCards";
import { MethodDrawer } from "./MethodDrawer";
import { TermsSheet } from "./TermsSheet";
import styles from "./charge.module.css";

type Completed = Extract<ChargeResult, { status: "COMPLETED" }>;

type Step =
  | { kind: "LOADING" }
  | { kind: "LOAD_ERROR" }
  | { kind: "FORM" }
  | { kind: "SUCCESS"; result: Completed }
  | { kind: "FAILED"; code: ChargeErrorCode }
  /** FLEXTV backend: paying in the provider's window. */
  | { kind: "PAYING"; started: Extract<ChargeResult, { status: "PAYMENT_STARTED" }>; popup: Window | null }
  /** FLEXTV backend: a 무통장입금 request waiting for the deposit. */
  | { kind: "DEPOSIT"; result: Extract<ChargeResult, { status: "DEPOSIT_REQUESTED" }> };

/**
 * Opens the payment window within the click (later, a popup blocker would stop it) with a holding page; the payment's
 * address follows once the server started the checkout. Null when the browser blocked it — the modal offers a button.
 */
function openPaymentWindow(t: T): Window | null {
  const popup = window.open("", "ssumnation-payment", "popup,width=480,height=760");
  if (popup) {
    popup.document.title = t("flextvCharge.windowTitle");
    popup.document.body.textContent = t("flextvCharge.windowOpening");
  }
  return popup;
}

type Selection = { type: "package"; id: string } | { type: "custom" } | null;

type Quote = { state: "idle" } | { state: "loading" } | { state: "ok"; fnAmount: number; price: number } | { state: "invalid"; minAmount: number };

/**
 * FN 충전 modal. Figma 595:1869 (default) · 672:2 (직접 입력) · 593:1677 (saved method) ·
 * 595:4891 (terms, first use) · 606:540 (완료) · 739:* (결제 취소).
 *
 * The browser only collects the choice. Price, balance and the outcome come from the server, and
 * each submission carries an idempotency key so a double click or a retry never charges twice.
 * UI text follows the language; the legal notes, payment-method names and the CHARGE_ERRORS copy stay as written.
 */
export function ChargeModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>({ kind: "LOADING" });
  const [options, setOptions] = useState<ChargeOptions | null>(null);
  const [termsAgreed, setTermsAgreed] = useState(true);
  const [selection, setSelection] = useState<Selection>(null);
  const [customInput, setCustomInput] = useState("");
  const [quote, setQuote] = useState<Quote>({ state: "idle" });
  const [methodId, setMethodId] = useState<PaymentMethodId | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // 입금자명 for 무통장입금 (FLEXTV backend).
  const [depositorName, setDepositorName] = useState("");
  // One key per distinct request; kept across a retry of the same request (see resetKey()).
  const keyRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setStep({ kind: "LOADING" });
    try {
      const data = await getChargeOptions();
      if (!data) {
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setOptions(data);
      setTermsAgreed(data.termsAgreed);
      setMethodId((current) => current ?? data.savedMethods[0] ?? null);
      setStep({ kind: "FORM" });
    } catch {
      setStep({ kind: "LOAD_ERROR" });
    }
  }, [pathname, router]);

  useEffect(() => {
    void load();
  }, [load]);

  // Custom amount → server quote (debounced).
  const customAmount = Number(customInput);
  useEffect(() => {
    if (selection?.type !== "custom" || !customInput) {
      setQuote({ state: "idle" });
      return;
    }
    setQuote({ state: "loading" });
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const q = await quoteCharge(customAmount);
        if (cancelled || !q) return;
        setQuote(q.status === "OK" ? { state: "ok", fnAmount: q.fnAmount, price: q.price } : { state: "invalid", minAmount: q.minAmount });
      } catch {
        if (!cancelled) setQuote({ state: "idle" });
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selection, customInput, customAmount]);

  const resetKey = () => {
    keyRef.current = null;
  };

  const selectedPackage = selection?.type === "package" ? options?.packages.find((p) => p.id === selection.id) : undefined;
  const total = selectedPackage ? selectedPackage.price : selection?.type === "custom" && quote.state === "ok" ? quote.price : null;
  const fnAmount = selectedPackage ? selectedPackage.fnAmount : selection?.type === "custom" && quote.state === "ok" ? quote.fnAmount : null;
  const deposit = methodId === "BANK_TRANSFER";
  const canSubmit = total !== null && methodId !== null && !submitting && (!deposit || depositorName.trim().length > 0);

  const submit = async () => {
    if (!canSubmit || !selection || !methodId) return;
    const amount: ChargeAmountInput = selection.type === "package" ? { packageId: selection.id } : { customAmount };
    keyRef.current ??= crypto.randomUUID();
    const popup = FLEXTV_WALLET && WINDOW_PAYMENT_METHODS.includes(methodId) ? openPaymentWindow(t) : null;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await requestCharge({ amount, methodId, idempotencyKey: keyRef.current, ...(deposit ? { depositorName: depositorName.trim() } : {}) });
      if (result.status !== "PAYMENT_STARTED") popup?.close();
      switch (result.status) {
        case "PAYMENT_STARTED":
          resetKey();
          if (popup) popup.location.href = result.payUrl;
          setStep({ kind: "PAYING", started: result, popup });
          break;
        case "DEPOSIT_REQUESTED":
          resetKey();
          setStep({ kind: "DEPOSIT", result });
          break;
        case "NOT_ELIGIBLE":
          setOptions((current) => current && { ...current, eligibility: result.eligibility });
          break;
        case "COMPLETED":
          resetKey();
          setStep({ kind: "SUCCESS", result });
          router.refresh(); // header, side nav and history show the new server balance
          break;
        case "FAILED":
          resetKey(); // nothing was charged; the next attempt is a new request
          setStep({ kind: "FAILED", code: result.code });
          break;
        case "IN_PROGRESS":
          setSubmitError(t("walletCharge.inProgress"));
          break;
        case "TERMS_REQUIRED":
          setTermsAgreed(false);
          break;
        case "UNAUTHORIZED":
          router.push(`/login?next=${encodeURIComponent(pathname)}`);
          break;
        default:
          resetKey();
          setSubmitError(t("walletCharge.checkCharge"));
      }
    } catch {
      popup?.close();
      // Unknown outcome: keep the key so retrying cannot charge twice.
      setSubmitError(t("walletCharge.unknownResult"));
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    step.kind === "SUCCESS"
      ? t("walletCharge.titleDone")
      : step.kind === "FAILED"
        ? t("walletCharge.titleFailed")
        : step.kind === "PAYING"
          ? t("walletCharge.titlePaying")
          : step.kind === "DEPOSIT"
            ? t("walletCharge.titleDeposit")
            : t("walletCharge.title");
  const ineligible = options?.eligibility && options.eligibility !== "OK" ? options.eligibility : null;
  const bonus = deposit && fnAmount !== null ? depositBonusOf(options?.depositBonus, fnAmount) : 0;

  return (
    <>
      <Modal open onClose={onClose} title={title} width={480}>
        {step.kind === "LOADING" && (
          <p className={styles.status} role="status">
            {t("walletCharge.loading")}
          </p>
        )}

        {step.kind === "LOAD_ERROR" && (
          <div className={styles.status} role="alert">
            <p>{t("walletCharge.loadError")}</p>
            <button type="button" className={styles.secondaryButton} onClick={() => void load()}>
              {t("walletCharge.retry")}
            </button>
          </div>
        )}

        {step.kind === "FORM" && options && ineligible && <EligibilityNotice eligibility={ineligible} onRecheck={() => void load()} onClose={onClose} />}

        {step.kind === "FORM" && options && !ineligible && (
          <div className={styles.formWrap}>
            {/* While the terms sheet is open the form behind it is inert (595:4891). */}
            <div className={styles.form} inert={!termsAgreed}>
              <div className={styles.balance}>
                <span>{t("walletCharge.balance")}</span>
                <strong>{formatNumber(options.balance)} FN</strong>
              </div>

              <section className={styles.section}>
                <h3 className={styles.label}>{t("walletCharge.chooseAmount")}</h3>
                <div className={styles.amounts}>
                  {selection?.type === "custom" ? (
                    <div className={`${styles.amount} ${styles.amountOn} ${styles.customOpen}`}>
                      <label className={styles.customInput}>
                        <input
                          autoFocus
                          inputMode="numeric"
                          aria-label={t("walletCharge.customFn")}
                          placeholder={t("walletCharge.customPlaceholder")}
                          value={customInput ? formatNumber(customAmount) : ""}
                          onChange={(e) => {
                            setCustomInput(e.target.value.replace(/[^\d]/g, "").replace(/^0+/, "").slice(0, 9));
                            resetKey();
                          }}
                        />
                        <span>FN</span>
                      </label>
                      <div className={styles.quoteRow}>
                        <span>{t("walletCharge.converted")}</span>
                        {quote.state === "ok" && <strong>{formatNumber(quote.price)}원</strong>}
                        {quote.state === "loading" && <span>{t("walletCharge.calculating")}</span>}
                        {quote.state === "invalid" && (
                          <span className={styles.error} role="alert">
                            {t("walletCharge.minAmount", { amount: formatNumber(quote.minAmount) })}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={`${styles.amount} ${styles.customTrigger}`}
                      onClick={() => {
                        setSelection({ type: "custom" });
                        resetKey();
                      }}
                    >
                      {t("walletCharge.custom")}
                    </button>
                  )}

                  {options.packages.map((p) => {
                    const on = selection?.type === "package" && selection.id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={on}
                        className={`${styles.amount} ${styles.package} ${on ? styles.amountOn : ""}`}
                        onClick={() => {
                          setSelection({ type: "package", id: p.id });
                          resetKey();
                        }}
                      >
                        <span>{formatNumber(p.fnAmount)} FN</span>
                        <span className={styles.price}>{formatNumber(p.price)}원</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.methodHeader}>
                  <h3 className={styles.label}>{t("walletCharge.method")}</h3>
                  <button type="button" className={styles.changeMethod} onClick={() => setDrawerOpen(true)}>
                    {t("walletCharge.changeMethod")} ▼
                  </button>
                </div>
                <label className={styles.radio}>
                  <input type="radio" name="charge-region" checked readOnly />
                  {t("walletCharge.domestic")}
                </label>
                <MethodCards
                  saved={options.savedMethods}
                  selected={methodId}
                  onSelect={(id) => {
                    setMethodId(id);
                    resetKey();
                  }}
                  onAdd={() => setDrawerOpen(true)}
                />
                {deposit && (
                  <div className={styles.section}>
                    <label className={styles.customInput}>
                      <input
                        aria-label={t("walletCharge.depositor")}
                        placeholder={t("walletCharge.depositorPlaceholder")}
                        maxLength={20}
                        value={depositorName}
                        onChange={(e) => {
                          setDepositorName(e.target.value);
                          resetKey();
                        }}
                      />
                    </label>
                    <p className={styles.muted}>
                      {t("walletCharge.depositNote")}
                      {bonus > 0 ? t("walletCharge.depositBonus", { amount: formatNumber(bonus) }) : ""}
                    </p>
                  </div>
                )}
                {/* TODO: overseas payment depends on the payment provider (TBD). */}
                <label className={`${styles.radio} ${styles.radioOff}`} title={t("common.comingSoon")}>
                  <input type="radio" name="charge-region" disabled />
                  {t("walletCharge.overseas")}
                </label>
              </section>

              <div className={styles.totalRow}>
                <div>
                  <strong className={styles.totalLabel}>{t("walletCharge.total")}</strong>
                  {/* Validity, tax and legal-guardian notes: legal text, Korean until an approved translation exists (TBD). */}
                  <ul className={styles.notes}>
                    <li>FN 유효기간: 마지막 사용일로부터 5년</li>
                    <li>결제 금액에는 모든 세금이 포함되어 있습니다.</li>
                    {FLEXTV_WALLET ? (
                      <li>본인인증을 마친 만 19세 이상 회원만 충전할 수 있습니다.</li>
                    ) : (
                      <li>만 19세 미만 미성년자 회원은 법정대리인 동의가 필요하며, 동의가 완료 된 후 FN 충전 서비스 이용이 가능합니다.</li>
                    )}
                  </ul>
                </div>
                <strong className={styles.total}>{formatNumber(total ?? 0)}원</strong>
              </div>

              {submitError && (
                <p className={styles.error} role="alert">
                  {submitError}
                </p>
              )}

              <button type="button" className={styles.submit} disabled={!canSubmit} onClick={() => void submit()}>
                {submitting ? t("walletCharge.paying") : t("walletCharge.charge")}
              </button>
            </div>

            {!termsAgreed && (
              <TermsSheet
                onCancel={onClose}
                onAgree={async (consents) => {
                  const r = await agreeChargeTerms(consents);
                  if (r.status === "AGREED") setTermsAgreed(true);
                  else if (r.status === "UNAUTHORIZED") router.push(`/login?next=${encodeURIComponent(pathname)}`);
                  return r.status === "AGREED";
                }}
              />
            )}
          </div>
        )}

        {step.kind === "SUCCESS" && <ChargeSuccess result={step.result} onClose={onClose} t={t} />}

        {step.kind === "PAYING" && (
          <PaymentWindowView
            started={step.started}
            popup={step.popup}
            onCompleted={(result) => {
              setStep({ kind: "SUCCESS", result });
              router.refresh();
            }}
            onFailed={(code) => setStep({ kind: "FAILED", code })}
            onUnauthorized={() => router.push(`/login?next=${encodeURIComponent(pathname)}`)}
            onClose={() => {
              // The payment may still finish in its window: the balance shows it on the next page.
              router.refresh();
              onClose();
            }}
          />
        )}

        {step.kind === "DEPOSIT" && <DepositRequestedView result={step.result} onClose={onClose} />}

        {step.kind === "FAILED" && (
          <ChargeFailure
            t={t}
            code={step.code}
            onClose={() => setStep({ kind: "FORM" })}
            onLeave={onClose}
            onChangeMethod={() => {
              setStep({ kind: "FORM" });
              setDrawerOpen(true);
            }}
            onRetry={() => {
              setStep({ kind: "FORM" });
              void submit();
            }}
          />
        )}
      </Modal>

      {options && (
        <MethodDrawer
          open={drawerOpen}
          methods={options.availableMethods}
          initial={methodId}
          onClose={() => setDrawerOpen(false)}
          onSelect={(id) => {
            setMethodId(id);
            resetKey();
            setDrawerOpen(false);
          }}
        />
      )}
    </>
  );
}

type T = ReturnType<typeof useI18n>["t"];

/** Figma 606:540 */
function ChargeSuccess({ result, onClose, t }: { result: Completed; onClose: () => void; t: T }) {
  return (
    <div className={styles.result}>
      <div className={styles.successCard}>
        <span>{t("walletCharge.done")}</span>
        <strong>{formatNumber(result.fnAmount)} FN</strong>
        <span className={styles.successPrice}>{formatNumber(result.price)}원</span>
      </div>
      <p className={styles.resultText}>
        {t("walletCharge.doneText")}
        <br />
        {t("walletCharge.doneBalance")}
      </p>
      <dl className={styles.resultRows}>
        <div>
          <dt>{t("walletCharge.method")}</dt>
          <dd>{PAYMENT_METHODS[result.methodId].name}</dd>
        </div>
        <div>
          <dt>{t("walletCharge.paidAmount")}</dt>
          <dd className={styles.accent}>{formatNumber(result.price)}원</dd>
        </div>
      </dl>
      <div className={styles.actions}>
        <Link href="/live" className={styles.primaryButton} onClick={onClose}>
          {t("walletCharge.watchLive")}
        </Link>
        <button type="button" className={styles.secondaryButton} onClick={onClose}>
          {t("walletCharge.ok")}
        </button>
      </div>
    </div>
  );
}

/**
 * Figma 739:28 · 739:132 · 739:236 · 739:340 · 739:444. `onLeave` closes the modal when 고객센터 is followed: opened from
 * the side menu, the modal lives in the layout and would stay open over the 고객센터 page. `t` comes from the modal.
 */
function ChargeFailure({
  t,
  code,
  onClose,
  onLeave,
  onChangeMethod,
  onRetry
}: {
  t: T;
  code: ChargeErrorCode;
  onClose: () => void;
  onLeave: () => void;
  onChangeMethod: () => void;
  onRetry: () => void;
}) {
  const copy = CHARGE_ERRORS[code];
  return (
    <div className={styles.result}>
      <div className={styles.failureCard} role="alert">
        <AlertCircleIcon />
        <strong>{copy.title}</strong>
        <p>{copy.lines[0]}</p>
        <p className={styles.muted}>{copy.lines[1]}</p>
        <span className={styles.codeChip}>{t("walletCharge.errorCode", { code })}</span>
      </div>
      <div className={styles.actions}>
        {copy.secondary === "SUPPORT" ? (
          <Link href="/support" className={styles.secondaryButton} onClick={onLeave}>
            {t("walletCharge.support")}
          </Link>
        ) : (
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            {t("walletCharge.ok")}
          </button>
        )}
        <button type="button" className={styles.primaryButton} onClick={copy.primary === "RETRY" ? onRetry : onChangeMethod}>
          {copy.primaryLabel}
        </button>
      </div>
    </div>
  );
}
