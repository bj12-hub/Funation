"use client";

import { useRef, useState, type FormEvent } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { isEmail, isValidNickname, isValidPassword } from "@/lib/validation";
import { checkEmailAvailability, checkNicknameAvailability } from "@/services/auth/signup";
import shared from "../shared/form.module.css";

/**
 * Figma: signup-step3 45:39 · email format 722:692 · email taken 722:765 · password format 722:838
 *        confirm mismatch 722:912 · nickname format 722:985 · nickname taken 722:1059
 */

const MSG_KEYS = {
  EMAIL_FORMAT: "auth.emailFormat",
  EMAIL_TAKEN: "auth.emailTaken",
  EMAIL_UNCHECKED: "auth.emailUnchecked",
  PASSWORD_FORMAT: "auth.passwordFormat",
  PASSWORD_MISMATCH: "auth.passwordMismatch",
  NICKNAME_FORMAT: "auth.nicknameFormat",
  NICKNAME_TAKEN: "auth.nicknameTaken",
  // Code-first: the 마이페이지 nickname change's FORBIDDEN copy (forbidden words and 익명).
  NICKNAME_FORBIDDEN: "auth.nicknameForbidden",
  NICKNAME_UNCHECKED: "auth.nicknameUnchecked",
  // The 중복 확인 request failed (network / server): the same copy as the sign-up submit's.
  CHECK_FAILED: "auth.tempError"
} as const satisfies Record<string, MessageKey>;

export type AccountValues = { email: string; password: string; nickname: string };

type AccountStepProps = {
  submitting: boolean;
  submitError: string | null;
  onBack: () => void;
  onSubmit: (values: AccountValues) => void;
};

type Check = "idle" | "checking" | "ok";

export function AccountStep({ submitting, submitError, onBack, onSubmit }: AccountStepProps) {
  const { t } = useI18n();
  const MSG = Object.fromEntries(Object.entries(MSG_KEYS).map(([k, key]) => [k, t(key)])) as Record<keyof typeof MSG_KEYS, string>;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailCheck, setEmailCheck] = useState<Check>("idle");
  const [nicknameCheck, setNicknameCheck] = useState<Check>("idle");
  const [errors, setErrors] = useState<Partial<Record<"email" | "password" | "confirm" | "nickname", string>>>({});
  // Bumped on every edit of the field: a 중복 확인 answer counts only while the field still holds the value it was asked
  // about (an edit during the check already reset the check; the new value needs its own).
  const emailEdits = useRef(0);
  const nicknameEdits = useRef(0);

  const setError = (field: keyof typeof errors, message?: string) => setErrors((e) => ({ ...e, [field]: message }));

  async function checkEmail() {
    if (!isEmail(email)) return setError("email", MSG.EMAIL_FORMAT);
    const asked = emailEdits.current;
    setEmailCheck("checking");
    try {
      const { available } = await checkEmailAvailability(email);
      if (asked !== emailEdits.current) return;
      setEmailCheck(available ? "ok" : "idle");
      setError("email", available ? undefined : MSG.EMAIL_TAKEN);
    } catch {
      if (asked !== emailEdits.current) return;
      setEmailCheck("idle");
      setError("email", MSG.CHECK_FAILED);
    }
  }

  async function checkNickname() {
    if (!isValidNickname(nickname)) return setError("nickname", MSG.NICKNAME_FORMAT);
    const asked = nicknameEdits.current;
    setNicknameCheck("checking");
    try {
      const { available, reason } = await checkNicknameAvailability(nickname);
      if (asked !== nicknameEdits.current) return;
      setNicknameCheck(available ? "ok" : "idle");
      setError(
        "nickname",
        available ? undefined : reason === "FORBIDDEN" ? MSG.NICKNAME_FORBIDDEN : reason === "INVALID" ? MSG.NICKNAME_FORMAT : MSG.NICKNAME_TAKEN
      );
    } catch {
      if (asked !== nicknameEdits.current) return;
      setNicknameCheck("idle");
      setError("nickname", MSG.CHECK_FAILED);
    }
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
      aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
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
          label={t("auth.emailLabel")}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="example@email.com"
          value={email}
          onChange={(e) => {
            emailEdits.current += 1;
            setEmail(e.target.value);
            setEmailCheck("idle");
            setError("email");
          }}
          error={errors.email}
          hint={emailCheck === "ok" ? t("auth.emailAvailable") : undefined}
          action={
            <Button variant="cta" onClick={checkEmail} disabled={emailCheck === "checking"}>
              {t("auth.checkAvailability")}
            </Button>
          }
        />
        <TextField
          label={t("auth.password")}
          name="new-password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder={t("auth.passwordPlaceholder", { min: 8, max: 20 })}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("password");
          }}
          onBlur={() => password && !isValidPassword(password) && setError("password", MSG.PASSWORD_FORMAT)}
          error={errors.password}
          hint={errors.password ? t("auth.passwordHint", { min: 8, max: 20 }) : undefined}
          trailing={eye}
        />
        <TextField
          label={t("auth.confirmPassword")}
          name="confirm-password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder={t("auth.confirmPlaceholder")}
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setError("confirm");
          }}
          onBlur={() => confirm && confirm !== password && setError("confirm", MSG.PASSWORD_MISMATCH)}
          error={errors.confirm}
        />
        <TextField
          label={t("auth.nickname")}
          name="nickname"
          placeholder={t("auth.nicknamePlaceholder", { min: 2, max: 12 })}
          maxLength={12}
          value={nickname}
          onChange={(e) => {
            nicknameEdits.current += 1;
            setNickname(e.target.value);
            setNicknameCheck("idle");
            setError("nickname");
          }}
          error={errors.nickname}
          hint={
            errors.nickname === MSG.NICKNAME_FORMAT
              ? t("auth.nicknameHint", { min: 2, max: 12 })
              : nicknameCheck === "ok"
                ? t("auth.nicknameAvailable")
                : undefined
          }
          action={
            <Button variant="cta" onClick={checkNickname} disabled={nicknameCheck === "checking"}>
              {t("auth.checkAvailability")}
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
        {submitting ? t("auth.signingUp") : t("auth.completeSignup")}
      </Button>
      <button type="button" className={`${shared.textLink} ${shared.underline}`} onClick={onBack}>
        {t("auth.previousStep")}
      </button>
    </form>
  );
}
