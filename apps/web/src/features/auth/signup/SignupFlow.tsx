"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignupStepper } from "@/components/auth/SignupStepper";
import { Button } from "@/components/ui/Button";
import { FLEXTV_AUTH } from "@/lib/flextv/mode";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { createFlextvAccount } from "@/services/auth/flextvSignup";
import { signup } from "@/services/auth/signup";
import { PhoneVerification } from "../shared/PhoneVerification";
import shared from "../shared/form.module.css";
import { AccountStep, type AccountValues } from "./AccountStep";
import { flextvAccountRules, ssumnationAccountRules } from "./accountRules";
import { TermsStep, type Agreements } from "./TermsStep";

/**
 * Sign-up flow: 약관 동의 → 번호 인증 → 계정 설정 → 완료
 * Figma: 280:56 · 13:63 · 722:599 · 45:39 · 723:183
 *
 * With the FLEXTV backend (docs/development/flextv-backend.md): 약관 동의 → 계정 설정 (FLEXTV's 아이디 rules) → 완료,
 * signed in right away. No 번호 인증: FLEXTV asks for its 본인인증 where it needs it (첫 충전 · 방송).
 */

type Step = 1 | 2 | 3 | 4;

const COPY: Record<Step, { title?: MessageKey; description?: MessageKey }> = {
  1: { title: "auth.stepTerms", description: "auth.stepTermsDescription" },
  2: { title: "auth.stepPhone", description: "auth.stepPhoneDescription" },
  3: { title: "auth.stepAccount", description: "auth.stepAccountDescription" },
  4: {}
};

/** The FLEXTV flow skips step 2: its steps 1 · 3 · 4 are shown as 1 · 2 · done. */
const FLEXTV_STEP_SHOWN: Record<Step, number> = { 1: 1, 2: 1, 3: 2, 4: 3 };

/** `socialLink`: offer 간편 로그인 연동 (마이페이지) after sign-up — not on the 도우미 domain, which has no 마이페이지. */
export function SignupFlow({ socialLink = true }: { socialLink?: boolean }) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>(1);
  const [agreements, setAgreements] = useState<Agreements>({ service: false, privacy: false, marketing: false });
  const [verified, setVerified] = useState<{ phone: string; token: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // The server refused the phone verification on submit (expired or already used): verify again.
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  // FLEXTV signs the new member in with the sign-up (false: the account exists, the member signs in on /login).
  const [signedIn, setSignedIn] = useState(false);

  const verifiedCopy = { title: "auth.phoneVerifiedTitle", description: "auth.phoneVerifiedDescription" } as const;
  const copy = step === 2 && verified ? verifiedCopy : COPY[step];

  async function handleSubmit(values: AccountValues) {
    if (FLEXTV_AUTH) return submitFlextv(values);
    if (!verified) return setStep(2);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await signup({
        email: values.identifier,
        password: values.password,
        nickname: values.nickname,
        phoneVerificationToken: verified.token,
        // The real agreement state: the server checks the required ones itself.
        agreements
      });
      if (result.status === "CREATED") setStep(4);
      else if (result.status === "EMAIL_TAKEN") setSubmitError(t("auth.emailTaken"));
      else if (result.status === "NICKNAME_TAKEN") setSubmitError(t("auth.nicknameTaken"));
      else if (result.status === "VERIFICATION_EXPIRED") {
        setVerified(null);
        setVerifyNotice(t("auth.verificationExpired"));
        setStep(2);
      } else setSubmitError(t("auth.checkInput"));
    } catch {
      setSubmitError(t("auth.tempError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitFlextv(values: AccountValues) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await createFlextvAccount({ loginId: values.identifier, password: values.password, nickname: values.nickname, agreements });
      if (result.status === "CREATED") {
        setSignedIn(result.signedIn);
        setStep(4);
      } else setSubmitError(t(FLEXTV_SIGNUP_ERRORS[result.status]));
    } catch {
      setSubmitError(t("auth.tempError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      size="lg"
      title={copy.title && t(copy.title)}
      description={copy.description && t(copy.description)}
      progress={FLEXTV_AUTH ? <SignupStepper current={FLEXTV_STEP_SHOWN[step]} steps={[t("auth.stepTerms"), t("auth.stepAccount")]} /> : <SignupStepper current={step} />}
    >
      {step === 1 && <TermsStep value={agreements} onChange={setAgreements} onNext={() => setStep(FLEXTV_AUTH ? 3 : 2)} />}

      {step === 2 && (
        <div className={shared.section}>
          {verified ? (
            <div className={shared.successBox} role="status">
              <strong>{t("auth.phoneVerified")}</strong>
              <span>{verified.phone}</span>
            </div>
          ) : (
            <>
              {verifyNotice && (
                <p className={shared.formError} role="alert">
                  {verifyNotice}
                </p>
              )}
              <PhoneVerification
                purpose="SIGNUP"
                onVerified={(v) => {
                  setVerifyNotice(null);
                  setVerified(v);
                }}
              />
            </>
          )}
          <Button block disabled={!verified} onClick={() => setStep(3)}>
            {t("auth.nextStep")}
          </Button>
        </div>
      )}

      {step === 3 && (
        <AccountStep
          submitting={submitting}
          submitError={submitError}
          onBack={() => setStep(FLEXTV_AUTH ? 1 : 2)}
          onSubmit={handleSubmit}
          rules={FLEXTV_AUTH ? flextvAccountRules : ssumnationAccountRules}
        />
      )}

      {step === 4 && (
        <div className={shared.section}>
          <div className={shared.center}>
            <span className={shared.successIcon} aria-hidden="true">
              ✓
            </span>
            <h1 className={shared.centerTitle}>{t("auth.welcomeTitle")}</h1>
            <p className={shared.centerText}>
              {t("auth.welcomeText")}
              <br />
              {signedIn ? t("auth.welcomeTextNow") : t("auth.welcomeTextAfter")}
            </p>
          </div>
          <div className={shared.divider} />
          {signedIn ? (
            <Button href="/" block>
              {t("auth.getStarted")}
            </Button>
          ) : (
            <Button href="/login" block>
              {t("auth.toLogin")}
            </Button>
          )}
          {/* 간편 로그인 연동은 로그인 후 마이페이지 > 계정 연결(Figma 743:2180, 743:2227)에서 진행 — not connected to FLEXTV yet */}
          {socialLink && !FLEXTV_AUTH && (
            <Button href="/mypage" variant="accent" block>
              <Image src="/images/social/kakao.png" alt="" width={30} height={30} style={{ borderRadius: 10 }} />
              <Image src="/images/social/google.png" alt="" width={30} height={30} style={{ borderRadius: 10 }} />
              {t("auth.linkSocial")}
            </Button>
          )}
        </div>
      )}

      {step < 3 && (
        <p className={shared.bottom}>
          <span>{t("auth.haveAccount")}</span>
          <Link href="/login" className={shared.bottomLink}>
            {t("auth.login")}
          </Link>
        </p>
      )}
    </AuthCard>
  );
}

const FLEXTV_SIGNUP_ERRORS = {
  LOGIN_ID_TAKEN: "auth.loginIdTaken",
  NICKNAME_TAKEN: "auth.nicknameTaken",
  FORBIDDEN: "auth.signupNicknameForbidden",
  BLOCKED: "auth.signupBlocked",
  INVALID: "auth.checkInput"
} as const satisfies Record<string, MessageKey>;
