"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useCountdown } from "@/hooks/useCountdown";
import { formatPhone, isValidPhone } from "@/lib/validation";
import { sendPhoneCode, verifyPhoneCode } from "@/services/auth/verification";
import { CODE_LENGTH, CODE_TTL_SECONDS } from "@/services/auth/verificationTypes";
import shared from "./form.module.css";

/**
 * Phone number + verification code form.
 * Figma: signup 13:63 · 722:473 (format) · 722:536 (invalid/expired)
 *        password reset 720:18 (not registered) · 720:60 · 720:103
 */

const MESSAGES = {
  PHONE_FORMAT: "휴대폰 번호가 올바른 형식이 아닙니다.",
  PHONE_NOT_FOUND: "가입한 휴대폰 번호와 일치하지 않습니다.",
  CODE_INVALID: "인증번호가 올바르지 않거나 유효시간이 지났습니다.",
  FAILED: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요"
};

type PhoneVerificationProps = {
  purpose: "SIGNUP" | "PASSWORD_RESET";
  onVerified: (result: { phone: string; token: string }) => void;
};

export function PhoneVerification({ purpose, onVerified }: PhoneVerificationProps) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const countdown = useCountdown();

  async function send() {
    if (!isValidPhone(phone)) return setPhoneError(MESSAGES.PHONE_FORMAT);
    setBusy("send");
    try {
      const result = await sendPhoneCode(phone, purpose);
      if (result.status === "PHONE_NOT_FOUND") return setPhoneError(MESSAGES.PHONE_NOT_FOUND);
      setPhoneError(null);
      setCodeError(null);
      setCode("");
      setSent(true);
      countdown.start(CODE_TTL_SECONDS);
    } catch {
      setPhoneError(MESSAGES.FAILED);
    } finally {
      setBusy(null);
    }
  }

  async function verify() {
    if (countdown.expired || code.length !== CODE_LENGTH) return setCodeError(MESSAGES.CODE_INVALID);
    setBusy("verify");
    try {
      const result = await verifyPhoneCode(phone, code);
      if (result.status === "VERIFIED") {
        countdown.stop();
        onVerified({ phone, token: result.verificationToken });
      } else {
        setCodeError(MESSAGES.CODE_INVALID);
      }
    } catch {
      setCodeError(MESSAGES.FAILED);
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
        aria-label="휴대폰 번호"
        value={phone}
        onChange={(e) => {
          setPhone(formatPhone(e.target.value));
          setPhoneError(null);
        }}
        error={phoneError}
        action={
          <Button variant="cta" onClick={send} disabled={busy !== null} aria-busy={busy === "send"}>
            {sent ? "재발송" : "인증번호 발송"}
          </Button>
        }
      />
      <TextField
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder={`인증번호 ${CODE_LENGTH}자리 입력`}
        aria-label="인증번호"
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
            <span className={`${shared.timer} ${countdown.expired ? shared.timerExpired : ""}`} aria-label="남은 유효시간">
              {countdown.label ?? "03:00"}
            </span>
            <Button variant="cta" onClick={verify} disabled={!sent || busy !== null} aria-busy={busy === "verify"}>
              인증 확인
            </Button>
          </>
        }
      />
      {sent && (
        <p className={shared.helper}>
          {countdown.expired ? "새 인증번호가 필요하신가요? " : "인증번호가 오지 않나요? "}
          <button type="button" className={shared.inlineLink} onClick={send} disabled={busy !== null}>
            재발송
          </button>
        </p>
      )}
    </div>
  );
}
