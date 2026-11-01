"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignupStepper } from "@/components/auth/SignupStepper";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import type { SocialProvider } from "@/lib/flextv/auth";
import { FLEXTV_NICKNAME_MAX, isFlextvNickname } from "@/lib/flextv/rules";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { completeSocialSignup, type SocialSignupResult } from "@/services/auth/flextvSignup";
import shared from "../shared/form.module.css";
import { TermsStep, type Agreements } from "./TermsStep";

/**
 * 간편 가입 (code-first, docs/development/flextv-backend.md "간편 로그인"): a 카카오 · 네이버 · 구글 account FLEXTV does
 * not know yet becomes a member after two short steps — 약관 동의, then a nickname (a suggestion is filled in). No
 * 아이디 or password: the member signs in with the same social account.
 */

const PROVIDER_NAME: Record<SocialProvider, MessageKey> = {
  kakao: "flextvSignup.providerKakao",
  naver: "flextvSignup.providerNaver",
  google: "flextvSignup.providerGoogle"
};

const ERRORS: Record<Exclude<SocialSignupResult["status"], "CREATED" | "EXPIRED" | "ALREADY_MEMBER">, MessageKey> = {
  NICKNAME_TAKEN: "auth.nicknameTaken",
  FORBIDDEN: "auth.nicknameForbidden",
  BLOCKED: "auth.signupBlocked",
  INVALID: "auth.checkInput"
};

export function SocialSignupFlow({ provider, suggestedNickname }: { provider: SocialProvider; suggestedNickname: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [agreements, setAgreements] = useState<Agreements>({ service: false, privacy: false, marketing: false });
  const [nickname, setNickname] = useState(suggestedNickname);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState<"EXPIRED" | "ALREADY_MEMBER" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const name = t(PROVIDER_NAME[provider]);

  if (ended) {
    return (
      <AuthCard title={ended === "EXPIRED" ? t("flextvSignup.expiredTitle") : t("flextvSignup.memberTitle")}>
        <div className={shared.section}>
          <p className={shared.centerText}>
            {ended === "EXPIRED" ? t("flextvSignup.expiredText", { provider: name }) : t("flextvSignup.memberText", { provider: name })}
          </p>
          <Button href="/login" block>
            {t("auth.toLogin")}
          </Button>
        </div>
      </AuthCard>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = nickname.trim();
    if (!isFlextvNickname(value)) return setError(t("flextvSignup.nicknameFormat", { min: 2, max: FLEXTV_NICKNAME_MAX }));
    setSubmitting(true);
    setError(null);
    try {
      const result = await completeSocialSignup({ nickname: value, agreements });
      if (result.status === "CREATED") {
        router.replace(result.next);
        router.refresh();
        return;
      }
      if (result.status === "EXPIRED" || result.status === "ALREADY_MEMBER") return setEnded(result.status);
      setError(t(ERRORS[result.status]));
    } catch {
      setError(t("auth.tempError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      size="lg"
      title={step === 1 ? t("auth.stepTerms") : t("flextvSignup.stepNickname")}
      description={step === 1 ? t("flextvSignup.termsDescription", { provider: name }) : t("flextvSignup.nicknameDescription")}
      progress={<SignupStepper current={step} steps={[t("auth.stepTerms"), t("flextvSignup.stepNickname")]} />}
    >
      {step === 1 ? (
        <TermsStep value={agreements} onChange={setAgreements} onNext={() => setStep(2)} />
      ) : (
        <form className={shared.section} onSubmit={handleSubmit} noValidate>
          <TextField
            label={t("auth.nickname")}
            name="nickname"
            placeholder={t("auth.nicknamePlaceholder", { min: 2, max: FLEXTV_NICKNAME_MAX })}
            maxLength={FLEXTV_NICKNAME_MAX}
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setError(null);
            }}
            error={error}
          />
          <div className={shared.divider} />
          <Button type="submit" variant="accent" block disabled={submitting} aria-busy={submitting}>
            {submitting ? t("auth.signingUp") : t("flextvSignup.submit")}
          </Button>
          <button type="button" className={`${shared.textLink} ${shared.underline}`} onClick={() => setStep(1)}>
            {t("auth.previousStep")}
          </button>
        </form>
      )}
      {step === 1 && (
        <p className={shared.bottom}>
          <span>{t("flextvSignup.otherMethod")}</span>
          <Link href="/signup" className={shared.bottomLink}>
            {t("auth.signup")}
          </Link>
        </p>
      )}
    </AuthCard>
  );
}
