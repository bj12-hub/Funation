"use client";

import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { ArrowLeftIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
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
  PASSWORD_FORMAT: "비밀번호가 형식에 맞지 않습니다. 다시 입력해 주세요.",
  // Same copy as the password change (747:685); the reset applies the same last-3 rule (2026-10-08 결정).
  PASSWORD_REUSED: "기존 비밀번호와 같거나 최근 사용한 비밀번호는 사용할 수 없습니다.",
  // Code-first (no Figma frame): the verification expired or was already used.
  VERIFICATION_EXPIRED: "인증이 만료되었어요. 휴대폰 인증을 다시 진행해 주세요.",
  FAILED: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요"
};

export function PasswordResetFlow() {
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
    if (!isEmail(email)) return setEmailError("올바른 이메일 형식이 아닙니다.");
    setBusy(true);
    try {
      const result = await sendPasswordResetEmail(email);
      if (result.status === "SENT") {
        setEmailError(null);
        setView("EMAIL_SENT");
      } else {
        setEmailError("입력한 이메일이 계정 정보와 일치하지 않습니다.");
      }
    } catch {
      setEmailError("일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요");
    } finally {
      setBusy(false);
    }
  }

  function verifyAgain() {
    setToken(null);
    setPwErrors({});
    setFormError(null);
    setPhoneNotice(MSG.VERIFICATION_EXPIRED);
    setView("PHONE");
  }

  async function submitNewPassword(event: FormEvent) {
    event.preventDefault();
    const next = {
      password: isValidPassword(password) ? undefined : MSG.PASSWORD_FORMAT,
      confirm: confirm && confirm === password ? undefined : "비밀번호가 일치하지 않습니다."
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
      else if (result.status === "REUSED") setPwErrors({ password: MSG.PASSWORD_REUSED });
      else setPwErrors({ password: MSG.PASSWORD_FORMAT });
    } catch {
      setFormError(MSG.FAILED);
    } finally {
      setBusy(false);
    }
  }

  const backToLogin = (
    <Button href="/login" variant="secondary">
      <ArrowLeftIcon />
      로그인으로 돌아가기
    </Button>
  );

  if (view === "EMAIL_SENT") {
    return (
      <AuthCard title="이메일을 확인해 주세요" description={<>비밀번호 재설정 이메일을 보냈습니다.<br />이메일 내 링크를 확인해 주세요.</>}>
        <div className={shared.successBox}>
          <span>도착까지 최대 10분이 걸릴 수 있습니다.</span>
          <span>보이지 않는다면 스팸메일함을 확인해 주세요.</span>
        </div>
        <div className={shared.row}>
          {backToLogin}
          <Button variant="pink" onClick={() => sendEmail()} disabled={busy} aria-busy={busy}>
            이메일 다시 보내기
          </Button>
        </div>
      </AuthCard>
    );
  }

  if (view === "NEW_PASSWORD") {
    return (
      <AuthCard title="비밀번호 재설정" description="새로 사용할 비밀번호를 입력해 주세요.">
        <form className={shared.section} onSubmit={submitNewPassword} noValidate>
          <div className={shared.stack}>
            <TextField
              type="password"
              autoComplete="new-password"
              placeholder="새로운 비밀번호"
              aria-label="새로운 비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={pwErrors.password}
              hint={pwErrors.password === MSG.PASSWORD_FORMAT ? "8~20자 · 영문, 숫자, 특수문자를 모두 포함해 주세요." : undefined}
            />
            <TextField
              type="password"
              autoComplete="new-password"
              placeholder="비밀번호 확인"
              aria-label="비밀번호 확인"
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
            새 비밀번호 설정
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
          <h1 className={shared.centerTitle}>비밀번호가 변경되었습니다</h1>
          <p className={shared.centerText}>새 비밀번호로 다시 로그인해 주세요.</p>
        </div>
        <Button href="/login" block>
          로그인 페이지로 이동
        </Button>
      </AuthCard>
    );
  }

  const isPhone = view === "PHONE";

  return (
    <AuthCard
      title="비밀번호 찾기"
      description={
        isPhone
          ? "가입하신 휴대폰 번호를 통해 인증번호를 보내드립니다."
          : emailError
            ? "가입하신 이메일 주소를 다시 확인해 주세요."
            : "가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다."
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
            onVerified={({ token: t }) => {
              setToken(t);
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
            placeholder="이메일 주소 입력"
            aria-label="이메일 주소"
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
              재설정 링크 보내기
            </Button>
          </div>
        </form>
      )}

      <button type="button" className={shared.textLink} onClick={() => setView(isPhone ? "EMAIL" : "PHONE")}>
        <ArrowLeftIcon />
        {isPhone ? "이메일로 인증하기" : "휴대폰 번호로 인증하기"}
      </button>
    </AuthCard>
  );
}
