"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircleIcon } from "@/components/icons";
import { FLEXTV_WEB_URL } from "@/lib/flextv/mode";
import { formatNumber } from "@/lib/format";
import { checkChargeStatus } from "@/services/wallet/charge";
import { PAYMENT_METHODS, type ChargeEligibility, type ChargeErrorCode, type ChargeResult, type ChargeStatusResult } from "@/services/wallet/chargeTypes";
import styles from "./charge.module.css";

/**
 * The FLEXTV backend's parts of the 충전 modal (code-first, docs/development/flextv-backend.md "2단계"): who may not
 * charge yet, the wait while the provider's payment window is open, and a 무통장입금 request.
 */

type Started = Extract<ChargeResult, { status: "PAYMENT_STARTED" }>;
type Deposit = Extract<ChargeResult, { status: "DEPOSIT_REQUESTED" }>;
type Completed = Extract<ChargeStatusResult, { status: "COMPLETED" }>;

const ELIGIBILITY_COPY: Record<Exclude<ChargeEligibility, "OK">, { title: string; text: string }> = {
  IDENTITY_REQUIRED: {
    title: "본인인증이 필요해요",
    text: "충전은 본인인증을 마친 만 19세 이상 회원만 이용할 수 있어요. 지금은 FLEXTV 사이트에서 본인인증을 진행한 뒤 다시 확인해 주세요."
  },
  MINOR: { title: "충전을 이용할 수 없어요", text: "만 19세 미만 회원은 충전할 수 없어요." },
  UNAVAILABLE: { title: "충전을 이용할 수 없어요", text: "이 계정은 충전을 이용할 수 없어요. 고객센터로 문의해 주세요." }
};

export function EligibilityNotice({ eligibility, onRecheck, onClose }: { eligibility: Exclude<ChargeEligibility, "OK">; onRecheck: () => void; onClose: () => void }) {
  const copy = ELIGIBILITY_COPY[eligibility];
  return (
    <div className={styles.result}>
      <div className={styles.failureCard} role="alert">
        <AlertCircleIcon />
        <strong>{copy.title}</strong>
        <p>{copy.text}</p>
      </div>
      <div className={styles.actions}>
        {eligibility === "IDENTITY_REQUIRED" ? (
          <>
            <button type="button" className={styles.secondaryButton} onClick={onRecheck}>
              다시 확인
            </button>
            <a className={styles.primaryButton} href={`${FLEXTV_WEB_URL}/my/personal-auth`} target="_blank" rel="noopener noreferrer">
              FLEXTV에서 본인인증하기
            </a>
          </>
        ) : (
          <button type="button" className={styles.primaryButton} onClick={onClose}>
            확인
          </button>
        )}
      </div>
    </div>
  );
}

/** How often and how long the modal asks FLEXTV while the payment window is open. */
const POLL_MS = 2_000;
const GIVE_UP_MS = 15 * 60 * 1000;
/** Checks after the window closed: the provider's notice to FLEXTV can arrive a moment later. */
const CHECKS_AFTER_CLOSE = 2;

/**
 * The member pays in the provider's window; this asks FLEXTV every few seconds until the payment is completed, failed,
 * or the window was closed without paying (then the member can check again or reopen it).
 */
export function PaymentWindowView({
  started,
  popup,
  onCompleted,
  onFailed,
  onUnauthorized,
  onClose
}: {
  started: Started;
  popup: Window | null;
  onCompleted: (result: Completed) => void;
  onFailed: (code: ChargeErrorCode) => void;
  onUnauthorized: () => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<"WAITING" | "NOT_DONE">("WAITING");
  const [checking, setChecking] = useState(false);
  const windowRef = useRef<Window | null>(popup);
  const callbacks = useRef({ onCompleted, onFailed, onUnauthorized });
  callbacks.current = { onCompleted, onFailed, onUnauthorized };

  /** One status read; true once the payment has an outcome. */
  const check = useCallback(async () => {
    try {
      const r = await checkChargeStatus(started.checkoutId);
      if (r.status === "COMPLETED") callbacks.current.onCompleted(r);
      else if (r.status === "FAILED") callbacks.current.onFailed(r.code);
      else if (r.status === "UNAUTHORIZED") callbacks.current.onUnauthorized();
      else return false;
      return true;
    } catch {
      return false;
    }
  }, [started.checkoutId]);

  useEffect(() => {
    if (state !== "WAITING") return;
    let stopped = false;
    let afterClose = 0;
    const deadline = Date.now() + GIVE_UP_MS;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (await check()) return;
      if (stopped) return;
      // A window the browser blocked never opened: keep asking while the member opens it with the button.
      if (windowRef.current?.closed) afterClose += 1;
      if (afterClose > CHECKS_AFTER_CLOSE || Date.now() > deadline) return setState("NOT_DONE");
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [state, check]);

  const [, setOpened] = useState(0);
  const reopen = () => {
    windowRef.current = window.open(started.payUrl, "ssumnation-payment", "popup,width=480,height=760");
    // Re-render so the buttons follow the window (and a new wait starts if it had ended).
    setOpened((n) => n + 1);
    setState("WAITING");
  };

  const recheck = async () => {
    setChecking(true);
    const done = await check();
    setChecking(false);
    if (!done) setState("NOT_DONE");
  };

  return (
    <div className={styles.result} aria-live="polite">
      <div className={styles.successCard}>
        <span>{PAYMENT_METHODS[started.methodId].name}</span>
        <strong>{formatNumber(started.fnAmount)} FN</strong>
        <span className={styles.successPrice}>{formatNumber(started.price)}원</span>
      </div>
      {state === "WAITING" ? (
        <p className={styles.resultText} role="status">
          결제창에서 결제를 마쳐 주세요.
          <br />
          결제가 끝나면 이 화면에 바로 반영돼요.
        </p>
      ) : (
        <p className={styles.resultText} role="alert">
          결제가 아직 완료되지 않았어요.
          <br />
          결제를 마쳤다면 다시 확인해 주세요.
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={onClose}>
          닫기
        </button>
        {state === "WAITING" && (!windowRef.current || windowRef.current.closed) ? (
          <button type="button" className={styles.primaryButton} onClick={reopen}>
            결제창 열기
          </button>
        ) : (
          <button type="button" className={styles.primaryButton} onClick={() => void recheck()} disabled={checking} aria-busy={checking}>
            {checking ? "확인 중..." : "결제 완료 확인"}
          </button>
        )}
      </div>
      {state === "NOT_DONE" && (
        <button type="button" className={styles.changeMethod} onClick={reopen}>
          결제창 다시 열기
        </button>
      )}
    </div>
  );
}

/** A 무통장입금 request: where to transfer, and that the FN arrive once the deposit is matched. */
export function DepositRequestedView({ result, onClose }: { result: Deposit; onClose: () => void }) {
  return (
    <div className={styles.result}>
      <div className={styles.successCard}>
        <span>입금 요청 완료</span>
        <strong>{formatNumber(result.fnAmount)} FN</strong>
        <span className={styles.successPrice}>{formatNumber(result.price)}원</span>
      </div>
      <p className={styles.resultText}>
        아래 계좌로 입금자명과 금액을 정확히 맞춰 입금해 주세요.
        <br />
        입금이 확인되면 FN이 들어와요.
      </p>
      <dl className={styles.resultRows}>
        {result.account ? (
          <>
            <div>
              <dt>입금 계좌</dt>
              <dd>
                {result.account.bank} {result.account.number}
              </dd>
            </div>
            <div>
              <dt>예금주</dt>
              <dd>{result.account.holder}</dd>
            </div>
          </>
        ) : (
          <div>
            <dt>입금 계좌</dt>
            <dd>고객센터에서 안내해 드려요</dd>
          </div>
        )}
        <div>
          <dt>입금자명</dt>
          <dd>{result.depositorName}</dd>
        </div>
        <div>
          <dt>입금 금액</dt>
          <dd className={styles.accent}>{formatNumber(result.price)}원</dd>
        </div>
        {result.bonusFn > 0 && (
          <div>
            <dt>입금 보너스</dt>
            <dd>+{formatNumber(result.bonusFn)} FN</dd>
          </div>
        )}
      </dl>
      <div className={styles.actions}>
        <button type="button" className={styles.primaryButton} onClick={onClose}>
          확인
        </button>
      </div>
    </div>
  );
}

/** The bonus a 무통장입금 of `fnAmount` earns (the server's rules, shown before the request). */
export function depositBonusOf(rules: { minAmount: number; percent: number }[] | undefined, fnAmount: number) {
  const rule = rules?.find((r) => fnAmount >= r.minAmount);
  return rule ? Math.floor((fnAmount * rule.percent) / 100) : 0;
}
