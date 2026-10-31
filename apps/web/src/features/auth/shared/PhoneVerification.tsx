"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useCountdown } from "@/hooks/useCountdown";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatPhone, isValidPhone } from "@/lib/validation";
import { sendPhoneCode, verifyPhoneCode } from "@/services/auth/verification";
import { CODE_LENGTH, CODE_TTL_SECONDS, type VerificationPurpose } from "@/services/auth/verificationTypes";
import shared from "./form.module.css";

/**
 * Phone number + verification code form.
 * Figma: signup 13:63 · 722:473 (format) · 722:536 (invalid/expired)
 *        password reset 720:18 (not registered) · 720:60 · 720:103
 */

const MESSAGES = {
  PHONE_FORMAT: "auth.phoneFormat",
  PHONE_NOT_FOUND: "auth.phoneNotFound",
  CODE_INVALID: "auth.codeInvalid",
  FAILED: "auth.tempError"
} as const satisfies Record<string, MessageKey>;

type PhoneVerificationProps = {
  purpose: VerificationPurpose;
  onVerified: (result: { phone: string; token: string }) => void;
};

export function PhoneVerification({ purpose, onVerified }: PhoneVerificationProps) {
  const { t } = useI18n();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const countdown = useCountdown();

  async function send() {
    if (!isValidPhone(phone)) return setPhoneError(t(MESSAGES.PHONE_FORMAT));
    setBusy("send");
    try {
      const result = await sendPhoneCode(phone, purpose);
      if (result.status === "PHONE_NOT_FOUND") return setPhoneError(t(MESSAGES.PHONE_NOT_FOUND));
      setPhoneError(null);
      setCodeError(null);
      setCode("");
      setSent(true);
      countdown.start(CODE_TTL_SECONDS);
    } catch {
      setPhoneError(t(MESSAGES.FAILED));
    } finally {
      setBusy(null);
    }
  }

  async function verify() {
    if (countdown.expired || code.length !== CODE_LENGTH) return setCodeError(t(MESSAGES.CODE_INVALID));
    setBusy("verify");
    try {
      const result = await verifyPhoneCode(phone, purpose, code);
      if (result.status === "VERIFIED") {
        countdown.stop();
        onVerified({ phone, token: result.verificationToken });
      } else {
        setCodeError(t(MESSAGES.CODE_INVALID));
      }
    } catch {
      setCodeError(t(MESSAGES.FAILED));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={shared.stack}>
      <TextField
        name="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="010-0000-0000"
        aria-label={t("auth.phone")}
        value={phone}
        onChange={(e) => {
          setPhone(formatPhone(e.target.value));
          setPhoneError(null);
        }}
        error={phoneError}
        action={
          <Button variant="cta" onClick={send} disabled={busy !== null} aria-busy={busy === "send"}>
            {sent ? t("auth.resend") : t("auth.sendCode")}
          </Button>
        }
      />
      <TextField
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder={t("auth.codePlaceholder", { length: CODE_LENGTH })}
        aria-label={t("auth.code")}
        maxLength={CODE_LENGTH}
        value={code}
        disabled={!sent}
        onChange={(e) => {
          setCode(e.target.value.replace(/\D/g, ""));
          setCodeError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            verify();
          }
        }}
        error={codeError}
        action={
          <>
            <span className={`${shared.timer} ${countdown.expired ? shared.timerExpired : ""}`} aria-label={t("auth.timeLeft")}>
              {countdown.label ?? "03:00"}
            </span>
            <Button variant="cta" onClick={verify} disabled={!sent || busy !== null} aria-busy={busy === "verify"}>
              {t("auth.verify")}
            </Button>
          </>
        }
      />
      {sent && (
        <p className={shared.helper}>
          {countdown.expired ? t("auth.needNewCode") : t("auth.noCode")}{" "}
          <button type="button" className={shared.inlineLink} onClick={send} disabled={busy !== null}>
            {t("auth.resend")}
          </button>
        </p>
      )}
    </div>
  );
}
