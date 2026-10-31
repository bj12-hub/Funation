"use client";

import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { ArrowLeftIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { isEmail, isValidPassword } from "@/lib/validation";
import { resetPassword, sendPasswordResetEmail } from "@/services/auth/passwordReset";
import { PhoneVerification } from "../shared/PhoneVerification";
import shared from "../shared/form.module.css";

/**
 * Password reset.
 * Email : 13:179 · not matched 718:626 · sent 718:582
 * Phone : 720:18 · 720:60 · 720:103 → new password 718:244
 */

type View = "EMAIL" | "EMAIL_SENT" | "PHONE" | "NEW_PASSWORD" | "DONE";

const MSG = {
  PASSWORD_FORMAT: "auth.passwordFormat",
  // Same copy as the password change (747:685); the reset applies the same last-3 rule (2026-10-08 결정).
  PASSWORD_REUSED: "auth.passwordReused",
  // Code-first (no Figma frame): the verification expired or was already used.
  VERIFICATION_EXPIRED: "auth.verificationExpired",
  FAILED: "auth.tempError"
} as const satisfies Record<string, MessageKey>;

export function PasswordResetFlow() {
  const { t } = useI18n();
  const [view, setView] = useState<View>("EMAIL");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwErrors, setPwErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  // Shown on the phone step when the server refused the verification (expired or already used).
  const [phoneNotice, setPhoneNotice] = useState<string | null>(null);

  async function sendEmail(event?: FormEvent) {
    event?.preventDefault();
    if (!isEmail(email)) return setEmailError(t("auth.emailFormat"));
    setBusy(true);
    try {
      const result = await sendPasswordResetEmail(email);
      if (result.status === "SENT") {
        setEmailError(null);
        setView("EMAIL_SENT");
      } else {
        setEmailError(t("auth.emailMismatch"));
      }
    } catch {
      setEmailError(t(MSG.FAILED));
    } finally {
      setBusy(false);
    }
  }

  function verifyAgain() {
    setToken(null);
    setPwErrors({});
    setFormError(null);
    setPhoneNotice(t(MSG.VERIFICATION_EXPIRED));
    setView("PHONE");
  }

  async function submitNewPassword(event: FormEvent) {
    event.preventDefault();
    const next = {
      password: isValidPassword(password) ? undefined : t(MSG.PASSWORD_FORMAT),
      confirm: confirm && confirm === password ? undefined : t("auth.passwordMismatch")
    };
    setPwErrors(next);
    setFormError(null);
    if (next.password || next.confirm) return;
    if (!token) return verifyAgain();
    setBusy(true);
    try {
      const result = await resetPassword(token, password);
      if (result.status === "RESET") setView("DONE");
      else if (result.status === "VERIFICATION_EXPIRED") verifyAgain();
      else if (result.status === "REUSED") setPwErrors({ password: t(MSG.PASSWORD_REUSED) });
      else setPwErrors({ password: t(MSG.PASSWORD_FORMAT) });
    } catch {
      setFormError(t(MSG.FAILED));
    } finally {
      setBusy(false);
    }
  }

  const backToLogin = (
    <Button href="/login" variant="secondary">
      <ArrowLeftIcon />
      {t("auth.backToLogin")}
    </Button>
  );

  if (view === "EMAIL_SENT") {
    return (
      <AuthCard title={t("auth.emailSentTitle")} description={<>{t("auth.emailSent")}<br />{t("auth.emailSentLink")}</>}>
        <div className={shared.successBox}>
          <span>{t("auth.emailArrival", { minutes: 10 })}</span>
          <span>{t("auth.emailSpam")}</span>
        </div>
        <div className={shared.row}>
          {backToLogin}
          <Button variant="pink" onClick={() => sendEmail()} disabled={busy} aria-busy={busy}>
            {t("auth.resendEmail")}
          </Button>
        </div>
      </AuthCard>
    );
  }

  if (view === "NEW_PASSWORD") {
    return (
      <AuthCard title={t("auth.resetPassword")} description={t("auth.newPasswordDescription")}>
        <form className={shared.section} onSubmit={submitNewPassword} noValidate>
          <div className={shared.stack}>
            <TextField
              type="password"
              autoComplete="new-password"
              placeholder={t("auth.newPassword")}
              aria-label={t("auth.newPassword")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={pwErrors.password}
              hint={pwErrors.password === t(MSG.PASSWORD_FORMAT) ? t("auth.passwordHint", { min: 8, max: 20 }) : undefined}
            />
            <TextField
              type="password"
              autoComplete="new-password"
              placeholder={t("auth.confirmPassword")}
              aria-label={t("auth.confirmPassword")}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={pwErrors.confirm}
            />
          </div>
          {formError && (
            <p className={shared.formError} role="alert">
              {formError}
            </p>
          )}
          <Button type="submit" block disabled={busy} aria-busy={busy}>
            {t("auth.setNewPassword")}
          </Button>
        </form>
      </AuthCard>
    );
  }

  if (view === "DONE") {
    return (
      <AuthCard>
        <div className={shared.center}>
          <span className={shared.successIcon} aria-hidden="true">
            ✓
          </span>
          <h1 className={shared.centerTitle}>{t("auth.passwordChanged")}</h1>
          <p className={shared.centerText}>{t("auth.loginWithNewPassword")}</p>
        </div>
        <Button href="/login" block>
          {t("auth.toLogin")}
        </Button>
      </AuthCard>
    );
  }

  const isPhone = view === "PHONE";

  return (
    <AuthCard
      title={t("auth.forgotPassword")}
      description={
        isPhone
          ? t("auth.resetDescriptionPhone")
          : emailError
            ? t("auth.resetDescriptionRecheck")
            : t("auth.resetDescriptionEmail")
      }
    >
      {isPhone ? (
        <div className={shared.section}>
          {phoneNotice && (
            <p className={shared.formError} role="alert">
              {phoneNotice}
            </p>
          )}
          <PhoneVerification
            purpose="PASSWORD_RESET"
            onVerified={({ token: verifiedToken }) => {
              setToken(verifiedToken);
              setPhoneNotice(null);
              setView("NEW_PASSWORD");
            }}
          />
          {backToLogin}
        </div>
      ) : (
        <form className={shared.section} onSubmit={sendEmail} noValidate>
          <TextField
            type="email"
            autoComplete="email"
            placeholder={t("auth.emailPlaceholder")}
            aria-label={t("auth.emailAddress")}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError(null);
            }}
            error={emailError}
          />
          <div className={shared.row}>
            {backToLogin}
            <Button type="submit" variant="pink" disabled={busy} aria-busy={busy}>
              {t("auth.sendResetLink")}
            </Button>
          </div>
        </form>
      )}

      <button type="button" className={shared.textLink} onClick={() => setView(isPhone ? "EMAIL" : "PHONE")}>
        <ArrowLeftIcon />
        {isPhone ? t("auth.verifyByEmail") : t("auth.verifyByPhone")}
      </button>
    </AuthCard>
  );
}
