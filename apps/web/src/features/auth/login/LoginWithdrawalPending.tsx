"use client";

import { useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { CalendarIcon } from "@/components/icons";
import { kstIsoString } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { login, type LoginRequest, type LoginResult } from "@/services/auth/login";
import styles from "./LoginForm.module.css";

/** "2026.12.02": the Korean day the 탈퇴 takes effect. */
const koreanDay = (iso: string) => kstIsoString(iso).slice(0, 10).replace(/-/g, ".");

/**
 * 탈퇴 신청한 계정 — code-first (no Figma frame), shown by the login form for WITHDRAWAL_PENDING (회원탈퇴 유예 30일,
 * 2026-11-01 사용자 결정, FLEXTV 조건 기본안). Says when the 탈퇴 takes effect and offers 탈퇴 철회: the same sign-in
 * again with `cancelWithdrawal`, which removes the request on the server and signs in (`onResult` handles the answer as
 * the form does — SUCCESS goes on to `next`, a suspension or a changed password shows on the form). "다른 계정으로
 * 로그인" goes back to the form. States: DEFAULT · PROCESSING ("철회하는 중…", both buttons disabled) · ERROR (a line;
 * the buttons work again).
 */
export function LoginWithdrawalPending({
  request,
  effectiveAt,
  onResult,
  onBack
}: {
  /** The sign-in that answered WITHDRAWAL_PENDING (identifier, password, keepSignedIn, next). */
  request: LoginRequest;
  effectiveAt: string;
  onResult: (result: LoginResult) => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<"DEFAULT" | "PROCESSING" | "ERROR">("DEFAULT");
  const processing = state === "PROCESSING";

  async function cancelAndLogin() {
    if (processing) return;
    setState("PROCESSING");
    try {
      const result = await login({ ...request, cancelWithdrawal: true });
      // A server-side redirect (password change prompt) resolves without a result.
      if (!result) return;
      onResult(result);
    } catch {
      setState("ERROR");
    }
  }

  return (
    <AuthCard title={t("auth.withdrawalPendingTitle")}>
      <div className={styles.recommend}>
        <span className={styles.recommendIcon} aria-hidden="true">
          <CalendarIcon />
        </span>
        <p>{t("auth.withdrawalPendingText", { date: koreanDay(effectiveAt) })}</p>
      </div>
      {state === "ERROR" && (
        <p className={styles.cardError} role="alert">
          {t("auth.cancelWithdrawalFailed")}
        </p>
      )}
      <div className={styles.buttons}>
        <button type="button" className={styles.primaryButton} disabled={processing} aria-busy={processing} onClick={cancelAndLogin}>
          {processing ? t("auth.cancellingWithdrawal") : t("auth.cancelWithdrawal")}
        </button>
        <button type="button" className={styles.textButton} disabled={processing} onClick={onBack}>
          {t("auth.otherAccount")}
        </button>
      </div>
    </AuthCard>
  );
}
