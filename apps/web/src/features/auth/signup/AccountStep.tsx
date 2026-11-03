"use client";

import { useRef, useState, type FormEvent } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import shared from "../shared/form.module.css";
import { ssumnationAccountRules, type AccountRulesFor } from "./accountRules";

/**
 * Figma: signup-step3 45:39 · email format 722:692 · email taken 722:765 · password format 722:838
 *        confirm mismatch 722:912 · nickname format 722:985 · nickname taken 722:1059
 * `rules`: the mock's e-mail account, or FLEXTV's 아이디 (./accountRules.ts) — same screen, same states.
 */

const MSG_KEYS = {
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

export type AccountValues = { identifier: string; password: string; nickname: string };

type AccountStepProps = {
  submitting: boolean;
  submitError: string | null;
  onBack: () => void;
  onSubmit: (values: AccountValues) => void;
  rules?: AccountRulesFor;
};

type Check = "idle" | "checking" | "ok";

export function AccountStep({ submitting, submitError, onBack, onSubmit, rules: rulesFor = ssumnationAccountRules }: AccountStepProps) {
  const { t } = useI18n();
  const MSG = Object.fromEntries(Object.entries(MSG_KEYS).map(([k, key]) => [k, t(key)])) as Record<keyof typeof MSG_KEYS, string>;
  const rules = rulesFor(t);
  const id = rules.identifier;
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [identifierCheck, setIdentifierCheck] = useState<Check>("idle");
  const [nicknameCheck, setNicknameCheck] = useState<Check>("idle");
  const [errors, setErrors] = useState<Partial<Record<"identifier" | "password" | "confirm" | "nickname", string>>>({});
  // Bumped on every edit of the field: a 중복 확인 answer counts only while the field still holds the value it was asked
  // about (an edit during the check already reset the check; the new value needs its own).
  const identifierEdits = useRef(0);
  const nicknameEdits = useRef(0);

  const setError = (field: keyof typeof errors, message?: string) => setErrors((e) => ({ ...e, [field]: message }));

  async function checkIdentifier() {
    if (!id.isValid(identifier)) return setError("identifier", id.messages.format);
    if (id.forbidden?.(identifier)) return setError("identifier", id.messages.forbidden);
    const asked = identifierEdits.current;
    setIdentifierCheck("checking");
    try {
      const { available, reason } = await id.check(identifier);
      if (asked !== identifierEdits.current) return;
      setIdentifierCheck(available ? "ok" : "idle");
      setError(
        "identifier",
        available ? undefined : reason === "FORBIDDEN" ? id.messages.forbidden : reason === "INVALID" ? id.messages.format : id.messages.taken
      );
    } catch {
      if (asked !== identifierEdits.current) return;
      setIdentifierCheck("idle");
      setError("identifier", MSG.CHECK_FAILED);
    }
  }

  async function checkNickname() {
    if (!rules.nickname.isValid(nickname)) return setError("nickname", MSG.NICKNAME_FORMAT);
    const asked = nicknameEdits.current;
    setNicknameCheck("checking");
    try {
      const { available, reason } = await rules.nickname.check(nickname);
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
      identifier: !id.isValid(identifier) ? id.messages.format : identifierCheck !== "ok" ? errors.identifier ?? id.messages.unchecked : undefined,
      password: !rules.password.isValid(password) ? MSG.PASSWORD_FORMAT : undefined,
      confirm: confirm !== password || !confirm ? MSG.PASSWORD_MISMATCH : undefined,
      nickname: !rules.nickname.isValid(nickname)
        ? MSG.NICKNAME_FORMAT
        : nicknameCheck !== "ok"
          ? errors.nickname ?? MSG.NICKNAME_UNCHECKED
          : undefined
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    onSubmit({ identifier: identifier.trim(), password, nickname });
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
          label={id.label}
          name={id.name}
          type={id.type}
          autoComplete={id.autoComplete}
          placeholder={id.placeholder}
          maxLength={id.maxLength}
          value={identifier}
          onChange={(e) => {
            identifierEdits.current += 1;
            setIdentifier(e.target.value);
            setIdentifierCheck("idle");
            setError("identifier");
          }}
          error={errors.identifier}
          hint={
            errors.identifier === id.messages.format && id.messages.formatHint
              ? id.messages.formatHint
              : identifierCheck === "ok"
                ? id.messages.available
                : undefined
          }
          action={
            <Button variant="cta" onClick={checkIdentifier} disabled={identifierCheck === "checking"}>
              {t("auth.checkAvailability")}
            </Button>
          }
        />
        <TextField
          label={t("auth.password")}
          name="new-password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder={rules.password.placeholder}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("password");
          }}
          onBlur={() => password && !rules.password.isValid(password) && setError("password", MSG.PASSWORD_FORMAT)}
          error={errors.password}
          hint={errors.password ? rules.password.hint : undefined}
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
          placeholder={rules.nickname.placeholder}
          maxLength={rules.nickname.maxLength}
          value={nickname}
          onChange={(e) => {
            nicknameEdits.current += 1;
            setNickname(e.target.value);
            setNicknameCheck("idle");
            setError("nickname");
          }}
          error={errors.nickname}
          hint={errors.nickname === MSG.NICKNAME_FORMAT ? rules.nickname.formatHint : nicknameCheck === "ok" ? t("auth.nicknameAvailable") : undefined}
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
