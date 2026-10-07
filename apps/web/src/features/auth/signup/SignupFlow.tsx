"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignupStepper } from "@/components/auth/SignupStepper";
import { Button } from "@/components/ui/Button";
import { signup } from "@/services/auth/signup";
import { PhoneVerification } from "../shared/PhoneVerification";
import shared from "../shared/form.module.css";
import { AccountStep, type AccountValues } from "./AccountStep";
import { TermsStep, type Agreements } from "./TermsStep";

/**
 * Sign-up flow: 약관 동의 → 번호 인증 → 계정 설정 → 완료
 * Figma: 280:56 · 13:63 · 722:599 · 45:39 · 723:183
 */

type Step = 1 | 2 | 3 | 4;

const COPY: Record<Step, { title?: string; description?: string }> = {
  1: { title: "약관 동의", description: "서비스 이용을 위해 필요한 약관에 동의해 주세요" },
  2: { title: "휴대폰 번호 인증", description: "본인 확인을 위해 휴대폰 번호를 인증해 주세요" },
  3: { title: "계정 설정", description: "아이디와 비밀번호를 설정해 주세요" },
  4: {}
};

export function SignupFlow() {
  const [step, setStep] = useState<Step>(1);
  const [agreements, setAgreements] = useState<Agreements>({ youth: false, service: false, privacy: false, marketing: false });
  const [verified, setVerified] = useState<{ phone: string; token: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // The server refused the phone verification on submit (expired or already used): verify again.
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);

  const verifiedCopy = { title: "휴대폰 인증 완료", description: "본인 확인이 완료되었습니다. 계정 설정을 계속해 주세요" };
  const copy = step === 2 && verified ? verifiedCopy : COPY[step];

  async function handleSubmit(values: AccountValues) {
    if (!verified) return setStep(2);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await signup({
        ...values,
        phoneVerificationToken: verified.token,
        // The real agreement state: the server checks the required ones itself.
        agreements
      });
      if (result.status === "CREATED") setStep(4);
      else if (result.status === "EMAIL_TAKEN") setSubmitError("이미 사용 중인 이메일입니다. 다른 이메일을 사용해 주세요.");
      else if (result.status === "NICKNAME_TAKEN") setSubmitError("이미 사용 중인 닉네임입니다. 다른 닉네임을 사용해 주세요.");
      else if (result.status === "VERIFICATION_EXPIRED") {
        setVerified(null);
        setVerifyNotice("인증이 만료되었어요. 휴대폰 인증을 다시 진행해 주세요.");
        setStep(2);
      } else setSubmitError("입력한 정보를 다시 확인해 주세요.");
    } catch {
      setSubmitError("일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard size="lg" title={copy.title} description={copy.description} progress={<SignupStepper current={step} />}>
      {step === 1 && <TermsStep value={agreements} onChange={setAgreements} onNext={() => setStep(2)} />}

      {step === 2 && (
        <div className={shared.section}>
          {verified ? (
            <div className={shared.successBox} role="status">
              <strong>휴대폰 인증이 완료되었습니다</strong>
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
            다음 단계
          </Button>
        </div>
      )}

      {step === 3 && (
        <AccountStep submitting={submitting} submitError={submitError} onBack={() => setStep(2)} onSubmit={handleSubmit} />
      )}

      {step === 4 && (
        <div className={shared.section}>
          <div className={shared.center}>
            <span className={shared.successIcon} aria-hidden="true">
              ✓
            </span>
            <h1 className={shared.centerTitle}>회원가입을 축하합니다!</h1>
            <p className={shared.centerText}>
              썸네이션 계정 생성이 완료되었습니다.
              <br />
              이제 로그인하고 다양한 콘텐츠를 만나보세요.
            </p>
          </div>
          <div className={shared.divider} />
          <Button href="/login" block>
            로그인 페이지로 이동
          </Button>
          {/* 간편 로그인 연동은 로그인 후 마이페이지 > 계정 연결(Figma 743:2180, 743:2227)에서 진행 */}
          <Button href="/mypage" variant="accent" block>
            <Image src="/images/social/kakao.png" alt="" width={30} height={30} style={{ borderRadius: 10 }} />
            <Image src="/images/social/google.png" alt="" width={30} height={30} style={{ borderRadius: 10 }} />
            간편 로그인 연동하러 가기
          </Button>
        </div>
      )}

      {step < 3 && (
        <p className={shared.bottom}>
          <span>이미 계정이 있으신가요?</span>
          <Link href="/login" className={shared.bottomLink}>
            로그인
          </Link>
        </p>
      )}
    </AuthCard>
  );
}
