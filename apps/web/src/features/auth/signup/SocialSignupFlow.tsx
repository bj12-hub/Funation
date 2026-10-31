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
import { completeSocialSignup, type SocialSignupResult } from "@/services/auth/flextvSignup";
import shared from "../shared/form.module.css";
import { TermsStep, type Agreements } from "./TermsStep";

/**
 * 간편 가입 (code-first, docs/development/flextv-backend.md "간편 로그인"): a 카카오 · 네이버 · 구글 account FLEXTV does
 * not know yet becomes a member after two short steps — 약관 동의, then a nickname (a suggestion is filled in). No
 * 아이디 or password: the member signs in with the same social account.
 */

const PROVIDER_NAME: Record<SocialProvider, string> = { kakao: "카카오", naver: "네이버", google: "구글" };
const STEPS = ["약관 동의", "닉네임 설정"] as const;

const ERRORS: Record<Exclude<SocialSignupResult["status"], "CREATED" | "EXPIRED" | "ALREADY_MEMBER">, string> = {
  NICKNAME_TAKEN: "이미 사용 중인 닉네임입니다. 다른 닉네임을 사용해 주세요.",
  FORBIDDEN: "사용할 수 없는 표현이 포함되어 있습니다.",
  BLOCKED: "지금은 가입할 수 없어요. 고객센터로 문의해 주세요.",
  INVALID: "입력한 정보를 다시 확인해 주세요."
};

export function SocialSignupFlow({ provider, suggestedNickname }: { provider: SocialProvider; suggestedNickname: string }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [agreements, setAgreements] = useState<Agreements>({ youth: false, service: false, privacy: false, marketing: false });
  const [nickname, setNickname] = useState(suggestedNickname);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState<"EXPIRED" | "ALREADY_MEMBER" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const name = PROVIDER_NAME[provider];

  if (ended) {
    return (
      <AuthCard title={ended === "EXPIRED" ? "다시 시도해 주세요" : "이미 가입된 계정이에요"}>
        <div className={shared.section}>
          <p className={shared.centerText}>
            {ended === "EXPIRED" ? `${name} 로그인이 만료되었어요. 처음부터 다시 진행해 주세요.` : `이 ${name} 계정으로 로그인해 주세요.`}
          </p>
          <Button href="/login" block>
            로그인 페이지로 이동
          </Button>
        </div>
      </AuthCard>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = nickname.trim();
    if (!isFlextvNickname(value)) return setError(`닉네임은 2~${FLEXTV_NICKNAME_MAX}자의 한글, 영문, 숫자로 입력해 주세요.`);
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
      setError(ERRORS[result.status]);
    } catch {
      setError("일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      size="lg"
      title={step === 1 ? "약관 동의" : "닉네임 설정"}
      description={step === 1 ? `${name} 계정으로 가입해요. 서비스 이용을 위해 필요한 약관에 동의해 주세요` : "방송과 채팅에서 보일 닉네임이에요. 나중에 바꿀 수 있어요"}
      progress={<SignupStepper current={step} steps={STEPS} />}
    >
      {step === 1 ? (
        <TermsStep value={agreements} onChange={setAgreements} onNext={() => setStep(2)} />
      ) : (
        <form className={shared.section} onSubmit={handleSubmit} noValidate>
          <TextField
            label="닉네임"
            name="nickname"
            placeholder={`2~${FLEXTV_NICKNAME_MAX}자 이내`}
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
            {submitting ? "가입 처리 중…" : "가입하고 시작하기"}
          </Button>
          <button type="button" className={`${shared.textLink} ${shared.underline}`} onClick={() => setStep(1)}>
            이전 단계로 돌아가기
          </button>
        </form>
      )}
      {step === 1 && (
        <p className={shared.bottom}>
          <span>다른 방법으로 가입할까요?</span>
          <Link href="/signup" className={shared.bottomLink}>
            회원가입
          </Link>
        </p>
      )}
    </AuthCard>
  );
}
