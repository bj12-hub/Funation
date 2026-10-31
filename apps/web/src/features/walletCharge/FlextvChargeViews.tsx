"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircleIcon } from "@/components/icons";
import { FLEXTV_WEB_URL } from "@/lib/flextv/mode";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
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

type T = ReturnType<typeof useI18n>["t"];

/** The age lines stay Korean in both languages (policy wording, docs/development/i18n.md). */
function eligibilityCopy(eligibility: Exclude<ChargeEligibility, "OK">, t: T): { title: string; text: string } {
  switch (eligibility) {
    case "IDENTITY_REQUIRED":
      return {
        title: t("flextvCharge.identityTitle"),
        text: `충전은 본인인증을 마친 만 19세 이상 회원만 이용할 수 있어요. ${t("flextvCharge.identityText")}`
      };
    case "MINOR":
      return { title: t("flextvCharge.unavailableTitle"), text: "만 19세 미만 회원은 충전할 수 없어요." };
    case "UNAVAILABLE":
      return { title: t("flextvCharge.unavailableTitle"), text: t("flextvCharge.unavailableText") };
  }
}

export function EligibilityNotice({ eligibility, onRecheck, onClose }: { eligibility: Exclude<ChargeEligibility, "OK">; onRecheck: () => void; onClose: () => void }) {
  const { t } = useI18n();
  const copy = eligibilityCopy(eligibility, t);
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
              {t("flextvCharge.recheck")}
            </button>
            <a className={styles.primaryButton} href={`${FLEXTV_WEB_URL}/my/personal-auth`} target="_blank" rel="noopener noreferrer">
              {t("flextvCharge.verifyOnFlextv")}
            </a>
          </>
        ) : (
          <button type="button" className={styles.primaryButton} onClick={onClose}>
            {t("walletCharge.ok")}
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
  const { t } = useI18n();
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
          {t("flextvCharge.waitingLine1")}
          <br />
          {t("flextvCharge.waitingLine2")}
        </p>
      ) : (
        <p className={styles.resultText} role="alert">
          {t("flextvCharge.notDoneLine1")}
          <br />
          {t("flextvCharge.notDoneLine2")}
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={onClose}>
          {t("walletCharge.close")}
        </button>
        {state === "WAITING" && (!windowRef.current || windowRef.current.closed) ? (
          <button type="button" className={styles.primaryButton} onClick={reopen}>
            {t("flextvCharge.openWindow")}
          </button>
        ) : (
          <button type="button" className={styles.primaryButton} onClick={() => void recheck()} disabled={checking} aria-busy={checking}>
            {checking ? t("flextvCharge.checking") : t("flextvCharge.checkPaid")}
          </button>
        )}
      </div>
      {state === "NOT_DONE" && (
        <button type="button" className={styles.changeMethod} onClick={reopen}>
          {t("flextvCharge.reopenWindow")}
        </button>
      )}
    </div>
  );
}

/** A 무통장입금 request: where to transfer, and that the FN arrive once the deposit is matched. */
export function DepositRequestedView({ result, onClose }: { result: Deposit; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className={styles.result}>
      <div className={styles.successCard}>
        <span>{t("flextvCharge.depositRequested")}</span>
        <strong>{formatNumber(result.fnAmount)} FN</strong>
        <span className={styles.successPrice}>{formatNumber(result.price)}원</span>
      </div>
      <p className={styles.resultText}>
        {t("flextvCharge.depositText")}
        <br />
        {t("walletCharge.depositNote")}
      </p>
      <dl className={styles.resultRows}>
        {result.account ? (
          <>
            <div>
              <dt>{t("flextvCharge.depositAccount")}</dt>
              <dd>
                {result.account.bank} {result.account.number}
              </dd>
            </div>
            <div>
              <dt>{t("flextvCharge.accountHolder")}</dt>
              <dd>{result.account.holder}</dd>
            </div>
          </>
        ) : (
          <div>
            <dt>{t("flextvCharge.depositAccount")}</dt>
            <dd>{t("flextvCharge.accountBySupport")}</dd>
          </div>
        )}
        <div>
          <dt>{t("walletCharge.depositor")}</dt>
          <dd>{result.depositorName}</dd>
        </div>
        <div>
          <dt>{t("flextvCharge.depositAmount")}</dt>
          <dd className={styles.accent}>{formatNumber(result.price)}원</dd>
        </div>
        {result.bonusFn > 0 && (
          <div>
            <dt>{t("flextvCharge.depositBonus")}</dt>
            <dd>+{formatNumber(result.bonusFn)} FN</dd>
          </div>
        )}
      </dl>
      <div className={styles.actions}>
        <button type="button" className={styles.primaryButton} onClick={onClose}>
          {t("walletCharge.ok")}
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
