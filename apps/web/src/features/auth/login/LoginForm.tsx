"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { CircleXIcon, EyeIcon, EyeOffIcon, MessageCircleIcon } from "@/components/icons";
import { TextField } from "@/components/ui/TextField";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { login, type LoginResult } from "@/services/auth/login";
import { LoginLocked } from "./LoginLocked";
import { LoginWithdrawalPending } from "./LoginWithdrawalPending";
import styles from "./LoginForm.module.css";

/**
 * Login screen.
 * Figma: DEFAULT 13:7 · UNKNOWN ID 718:123 · WRONG PASSWORD 718:168 · LOCKED 718:213 (718:335 is its own route: /login/password-change)
 * Code-first: WITHDRAWAL_PENDING (탈퇴 신청한 계정, 회원탈퇴 유예 30일 — 2026-11-01 사용자 결정) shows its own card,
 * which can cancel the 탈퇴 and sign in (./LoginWithdrawalPending.tsx).
 */

type FormState = "DEFAULT" | "PROCESSING" | "UNKNOWN_ID" | "WRONG_PASSWORD" | "LOCKED" | "SUSPENDED" | "WITHDRAWAL_PENDING" | "ERROR";

const MESSAGES = {
  UNKNOWN_ID: "auth.unknownId",
  WRONG_PASSWORD: "auth.wrongPassword",
  // Code-first (no Figma frame): the account is suspended by an operator (appeal flow TBD).
  SUSPENDED: "auth.suspended",
  // The 도우미 domain has no 고객센터 of its own (and the site's domain is TBD): name the site's, without a link.
  SUSPENDED_HELPER: "auth.suspendedHelper",
  ERROR: "auth.tempError"
} as const satisfies Record<string, MessageKey>;

/**
 * `next`: where to go after signing in (already validated as a same-site path). `supportLink`: 고객센터 (`/support`) is on
 * this host — false on the 도우미 domain, where the help lines name the site's 고객센터 in plain text.
 */
export function LoginForm({ next = "/", supportLink = true }: { next?: string; supportLink?: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<FormState>("DEFAULT");
  // WITHDRAWAL_PENDING: when the account's 탈퇴 takes effect.
  const [effectiveAt, setEffectiveAt] = useState("");
  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const request = { identifier: identifier.trim(), password, keepSignedIn, next };

  /** The sign-in's answer, from the form or from the 탈퇴 철회 card. */
  function handleResult(result: LoginResult) {
    if (result.status === "SUCCESS") {
      // The session cookie was set by the server action; refresh so layouts read it.
      router.replace(next);
      router.refresh();
      return;
    }
    if (result.status === "WITHDRAWAL_PENDING") setEffectiveAt(result.effectiveAt);
    setState(result.status);
    if (result.status === "WRONG_PASSWORD") {
      // Figma 718:168 keeps the entered password; select it so the user can retype.
      passwordRef.current?.select();
    }
  }

  if (state === "LOCKED") return <LoginLocked supportLink={supportLink} />;
  if (state === "WITHDRAWAL_PENDING") {
    // "다른 계정으로 로그인": back to an empty form.
    const back = () => {
      setIdentifier("");
      setPassword("");
      setState("DEFAULT");
    };
    return <LoginWithdrawalPending request={request} effectiveAt={effectiveAt} onResult={handleResult} onBack={back} />;
  }

  const processing = state === "PROCESSING";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (processing) return;
    if (!identifier.trim()) return identifierRef.current?.focus();
    if (!password) return passwordRef.current?.focus();

    setState("PROCESSING");
    try {
      const result = await login(request);
      // A server-side redirect (password change prompt) resolves without a result.
      if (!result) return;
      handleResult(result);
    } catch {
      setState("ERROR");
    }
  }

  return (
    <AuthCard title={t("auth.login")}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.inputs}>
          <TextField
            ref={identifierRef}
            name="identifier"
            autoComplete="username"
            placeholder={t("auth.identifier")}
            aria-label={t("auth.identifier")}
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              if (state === "UNKNOWN_ID") setState("DEFAULT");
            }}
            error={state === "UNKNOWN_ID" ? t(MESSAGES.UNKNOWN_ID) : null}
          />
          <TextField
            ref={passwordRef}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder={t("auth.password")}
            aria-label={t("auth.password")}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (state === "WRONG_PASSWORD") setState("DEFAULT");
            }}
            error={state === "WRONG_PASSWORD" ? t(MESSAGES.WRONG_PASSWORD) : null}
            trailing={
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            }
          />
        </div>

        <div className={styles.options}>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={keepSignedIn} onChange={(e) => setKeepSignedIn(e.target.checked)} />
            <span className={styles.checkboxBox} aria-hidden="true" />
            {t("auth.keepSignedIn")}
          </label>
          <Link href="/password-reset" className={styles.textLink}>
            {t("auth.forgotPassword")}
          </Link>
        </div>

        {(state === "ERROR" || state === "SUSPENDED") && (
          <p className={styles.formError} role="alert">
            {t(state === "SUSPENDED" && !supportLink ? MESSAGES.SUSPENDED_HELPER : MESSAGES[state])}
          </p>
        )}

        <button type="submit" className={styles.primaryButton} disabled={processing} aria-busy={processing}>
          {processing ? t("auth.loggingIn") : state === "WRONG_PASSWORD" ? t("auth.loginAgain") : t("auth.login")}
        </button>
      </form>

      <div className={styles.divider}>
        <span className={styles.dividerLine} />
        <span>{t("auth.or")}</span>
        <span className={styles.dividerLine} />
      </div>

      {/* TODO: connect OAuth once providers are configured (Figma social-login-page 13:142) */}
      <div className={styles.social}>
        <button type="button" className={`${styles.socialButton} ${styles.google}`}>
          <CircleXIcon />
          {t("auth.google")}
        </button>
        <button type="button" className={`${styles.socialButton} ${styles.kakao}`}>
          <MessageCircleIcon />
          {t("auth.kakao")}
        </button>
      </div>

      <p className={styles.bottom}>
        <span>{t("auth.notMember")}</span>
        <Link href="/signup" className={styles.signupLink}>
          {t("auth.signup")}
        </Link>
      </p>
    </AuthCard>
  );
}
