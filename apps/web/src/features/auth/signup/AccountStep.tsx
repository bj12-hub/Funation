"use client";

import { useState, type FormEvent } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { isEmail, isValidNickname, isValidPassword } from "@/lib/validation";
import { checkEmailAvailability, checkNicknameAvailability } from "@/services/auth/signup";
import shared from "../shared/form.module.css";

/**
 * Figma: signup-step3 45:39 · email format 722:692 · email taken 722:765 · password format 722:838
 *        confirm mismatch 722:912 · nickname format 722:985 · nickname taken 722:1059
 */

const MSG = {
  EMAIL_FORMAT: "올바른 이메일 형식이 아닙니다.",
  EMAIL_TAKEN: "이미 사용 중인 이메일입니다. 다른 이메일을 사용해 주세요.",
  EMAIL_UNCHECKED: "이메일 중복 확인을 해 주세요.",
  PASSWORD_FORMAT: "비밀번호가 형식에 맞지 않습니다. 다시 입력해 주세요.",
  PASSWORD_MISMATCH: "비밀번호가 일치하지 않습니다.",
  NICKNAME_FORMAT: "올바른 닉네임 형식이 아닙니다.",
  NICKNAME_TAKEN: "이미 사용 중인 닉네임입니다. 다른 닉네임을 사용해 주세요.",
  NICKNAME_UNCHECKED: "닉네임 중복 확인을 해 주세요."
};

export type AccountValues = { email: string; password: string; nickname: string };

type AccountStepProps = {
  submitting: boolean;
  submitError: string | null;
  onBack: () => void;
  onSubmit: (values: AccountValues) => void;
};

type Check = "idle" | "checking" | "ok";

export function AccountStep({ submitting, submitError, onBack, onSubmit }: AccountStepProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailCheck, setEmailCheck] = useState<Check>("idle");
  const [nicknameCheck, setNicknameCheck] = useState<Check>("idle");
  const [errors, setErrors] = useState<Partial<Record<"email" | "password" | "confirm" | "nickname", string>>>({});

  const setError = (field: keyof typeof errors, message?: string) => setErrors((e) => ({ ...e, [field]: message }));

  async function checkEmail() {
    if (!isEmail(email)) return setError("email", MSG.EMAIL_FORMAT);
    setEmailCheck("checking");
    const { available } = await checkEmailAvailability(email);
    setEmailCheck(available ? "ok" : "idle");
    setError("email", available ? undefined : MSG.EMAIL_TAKEN);
  }

  async function checkNickname() {
    if (!isValidNickname(nickname)) return setError("nickname", MSG.NICKNAME_FORMAT);
    setNicknameCheck("checking");
    const { available } = await checkNicknameAvailability(nickname);
    setNicknameCheck(available ? "ok" : "idle");
    setError("nickname", available ? undefined : MSG.NICKNAME_TAKEN);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {
      email: !isEmail(email) ? MSG.EMAIL_FORMAT : emailCheck !== "ok" ? errors.email ?? MSG.EMAIL_UNCHECKED : undefined,
      password: !isValidPassword(password) ? MSG.PASSWORD_FORMAT : undefined,
      confirm: confirm !== password || !confirm ? MSG.PASSWORD_MISMATCH : undefined,
      nickname: !isValidNickname(nickname)
        ? MSG.NICKNAME_FORMAT
        : nicknameCheck !== "ok"
          ? errors.nickname ?? MSG.NICKNAME_UNCHECKED
          : undefined
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    onSubmit({ email: email.trim(), password, nickname });
  }

  const eye = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
      aria-pressed={showPassword}
      style={{ display: "flex" }}
    >
      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );

  return (
    <form className={shared.section} onSubmit={handleSubmit} noValidate>
      <div className={shared.stack}>
        <TextField
          label="아이디 (이메일)"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="example@email.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailCheck("idle");
            setError("email");
          }}
          error={errors.email}
          hint={emailCheck === "ok" ? "사용 가능한 이메일입니다." : undefined}
          action={
            <Button variant="cta" onClick={checkEmail} disabled={emailCheck === "checking"}>
              중복 확인
            </Button>
          }
        />
        <TextField
          label="비밀번호"
          name="new-password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="8자 이상, 영문/숫자/특수문자 포함"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("password");
          }}
          onBlur={() => password && !isValidPassword(password) && setError("password", MSG.PASSWORD_FORMAT)}
          error={errors.password}
          hint={errors.password ? "8자 이상 · 영문, 숫자, 특수문자를 모두 포함해 주세요." : undefined}
          trailing={eye}
        />
        <TextField
          label="비밀번호 확인"
          name="confirm-password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="비밀번호를 다시 입력해 주세요"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setError("confirm");
          }}
          onBlur={() => confirm && confirm !== password && setError("confirm", MSG.PASSWORD_MISMATCH)}
          error={errors.confirm}
        />
        <TextField
          label="닉네임"
          name="nickname"
          placeholder="2~12자 이내"
          maxLength={12}
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value);
            setNicknameCheck("idle");
            setError("nickname");
          }}
          error={errors.nickname}
          hint={
            errors.nickname === MSG.NICKNAME_FORMAT
              ? "2~12자의 한글, 영문, 숫자만 사용할 수 있어요."
              : nicknameCheck === "ok"
                ? "사용 가능한 닉네임입니다."
                : undefined
          }
          action={
            <Button variant="cta" onClick={checkNickname} disabled={nicknameCheck === "checking"}>
              중복 확인
            </Button>
          }
        />
      </div>

      <div className={shared.divider} />
      {submitError && (
        <p className={shared.formError} role="alert">
          {submitError}
        </p>
      )}
      <Button type="submit" variant="accent" block disabled={submitting} aria-busy={submitting}>
        {submitting ? "가입 처리 중…" : "회원가입 완료"}
      </Button>
      <button type="button" className={`${shared.textLink} ${shared.underline}`} onClick={onBack}>
        이전 단계로 돌아가기
      </button>
    </form>
  );
}
