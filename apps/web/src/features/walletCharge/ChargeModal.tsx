"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertCircleIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { formatNumber } from "@/lib/format";
import { agreeChargeTerms, getChargeOptions, quoteCharge, requestCharge } from "@/services/wallet/charge";
import {
  CHARGE_ERRORS,
  PAYMENT_METHODS,
  type ChargeAmountInput,
  type ChargeErrorCode,
  type ChargeOptions,
  type ChargeResult,
  type PaymentMethodId
} from "@/services/wallet/chargeTypes";
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
  | { kind: "FAILED"; code: ChargeErrorCode };

type Selection = { type: "package"; id: string } | { type: "custom" } | null;

type Quote = { state: "idle" } | { state: "loading" } | { state: "ok"; fnAmount: number; price: number } | { state: "invalid"; minAmount: number };

/**
 * FN 충전 modal. Figma 595:1869 (default) · 672:2 (직접 입력) · 593:1677 (saved method) ·
 * 595:4891 (terms, first use) · 606:540 (완료) · 739:* (결제 취소).
 *
 * The browser only collects the choice. Price, balance and the outcome come from the server, and
 * each submission carries an idempotency key so a double click or a retry never charges twice.
 */
export function ChargeModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
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
  const canSubmit = total !== null && methodId !== null && !submitting;

  const submit = async () => {
    if (!canSubmit || !selection || !methodId) return;
    const amount: ChargeAmountInput = selection.type === "package" ? { packageId: selection.id } : { customAmount };
    keyRef.current ??= crypto.randomUUID();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await requestCharge({ amount, methodId, idempotencyKey: keyRef.current });
      switch (result.status) {
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
          setSubmitError("결제를 처리하고 있습니다. 잠시 후 다시 시도해 주세요.");
          break;
        case "TERMS_REQUIRED":
          setTermsAgreed(false);
          break;
        case "UNAUTHORIZED":
          router.push(`/login?next=${encodeURIComponent(pathname)}`);
          break;
        default:
          resetKey();
          setSubmitError("충전 정보를 다시 확인해 주세요.");
      }
    } catch {
      // Unknown outcome: keep the key so retrying cannot charge twice.
      setSubmitError("결제 결과를 확인하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const title = step.kind === "SUCCESS" ? "FN 충전 완료" : step.kind === "FAILED" ? "결제 취소" : "FN 충전하기";

  return (
    <>
      <Modal open onClose={onClose} title={title} width={480}>
        {step.kind === "LOADING" && (
          <p className={styles.status} role="status">
            충전 정보를 불러오는 중입니다...
          </p>
        )}

        {step.kind === "LOAD_ERROR" && (
          <div className={styles.status} role="alert">
            <p>충전 정보를 불러오지 못했습니다.</p>
            <button type="button" className={styles.secondaryButton} onClick={() => void load()}>
              다시 시도
            </button>
          </div>
        )}

        {step.kind === "FORM" && options && (
          <div className={styles.formWrap}>
            {/* While the terms sheet is open the form behind it is inert (595:4891). */}
            <div className={styles.form} inert={!termsAgreed}>
              <div className={styles.balance}>
                <span>현재 보유 FN</span>
                <strong>{formatNumber(options.balance)} FN</strong>
              </div>

              <section className={styles.section}>
                <h3 className={styles.label}>충전 금액 선택</h3>
                <div className={styles.amounts}>
                  {selection?.type === "custom" ? (
                    <div className={`${styles.amount} ${styles.amountOn} ${styles.customOpen}`}>
                      <label className={styles.customInput}>
                        <input
                          autoFocus
                          inputMode="numeric"
                          aria-label="충전할 FN"
                          placeholder="충전할 금액을 입력해 주세요"
                          value={customInput ? formatNumber(customAmount) : ""}
                          onChange={(e) => {
                            setCustomInput(e.target.value.replace(/[^\d]/g, "").replace(/^0+/, "").slice(0, 9));
                            resetKey();
                          }}
                        />
                        <span>FN</span>
                      </label>
                      <div className={styles.quoteRow}>
                        <span>환산 금액</span>
                        {quote.state === "ok" && <strong>{formatNumber(quote.price)}원</strong>}
                        {quote.state === "loading" && <span>계산 중...</span>}
                        {quote.state === "invalid" && (
                          <span className={styles.error} role="alert">
                            최소 {formatNumber(quote.minAmount)} FN부터 충전할 수 있습니다.
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
                      + 직접 입력
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
                  <h3 className={styles.label}>결제 수단</h3>
                  <button type="button" className={styles.changeMethod} onClick={() => setDrawerOpen(true)}>
                    결제수단변경 ▼
                  </button>
                </div>
                <label className={styles.radio}>
                  <input type="radio" name="charge-region" checked readOnly />
                  국내 결제
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
                {/* TODO: overseas payment depends on the payment provider (TBD). */}
                <label className={`${styles.radio} ${styles.radioOff}`} title="준비 중인 기능입니다">
                  <input type="radio" name="charge-region" disabled />
                  해외 결제
                </label>
              </section>

              <div className={styles.totalRow}>
                <div>
                  <strong className={styles.totalLabel}>최종 결제 금액</strong>
                  <ul className={styles.notes}>
                    <li>FN 유효기간: 마지막 사용일로부터 5년</li>
                    <li>결제 금액에는 모든 세금이 포함되어 있습니다.</li>
                    <li>만 19세 미만 미성년자 회원은 법정대리인 동의가 필요하며, 동의가 완료 된 후 FN 충전 서비스 이용이 가능합니다.</li>
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
                {submitting ? "결제 진행 중..." : "충전하기"}
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

        {step.kind === "SUCCESS" && <ChargeSuccess result={step.result} onClose={onClose} />}

        {step.kind === "FAILED" && (
          <ChargeFailure
            code={step.code}
            onClose={() => setStep({ kind: "FORM" })}
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

/** Figma 606:540 */
function ChargeSuccess({ result, onClose }: { result: Completed; onClose: () => void }) {
  return (
    <div className={styles.result}>
      <div className={styles.successCard}>
        <span>충전 완료</span>
        <strong>{formatNumber(result.fnAmount)} FN</strong>
        <span className={styles.successPrice}>{formatNumber(result.price)}원</span>
      </div>
      <p className={styles.resultText}>
        결제가 정상적으로 완료되었습니다.
        <br />
        보유 FN이 즉시 반영되었어요.
      </p>
      <dl className={styles.resultRows}>
        <div>
          <dt>결제 수단</dt>
          <dd>{PAYMENT_METHODS[result.methodId].name}</dd>
        </div>
        <div>
          <dt>결제 금액</dt>
          <dd className={styles.accent}>{formatNumber(result.price)}원</dd>
        </div>
      </dl>
      <div className={styles.actions}>
        <Link href="/live" className={styles.primaryButton} onClick={onClose}>
          LIVE 보러가기
        </Link>
        <button type="button" className={styles.secondaryButton} onClick={onClose}>
          확인
        </button>
      </div>
    </div>
  );
}

/** Figma 739:28 · 739:132 · 739:236 · 739:340 · 739:444 */
function ChargeFailure({
  code,
  onClose,
  onChangeMethod,
  onRetry
}: {
  code: ChargeErrorCode;
  onClose: () => void;
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
        <span className={styles.codeChip}>오류 코드 · {code}</span>
      </div>
      <div className={styles.actions}>
        {copy.secondary === "SUPPORT" ? (
          <Link href="/support" className={styles.secondaryButton}>
            고객센터
          </Link>
        ) : (
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            확인
          </button>
        )}
        <button type="button" className={styles.primaryButton} onClick={copy.primary === "RETRY" ? onRetry : onChangeMethod}>
          {copy.primaryLabel}
        </button>
      </div>
    </div>
  );
}
