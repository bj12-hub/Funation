"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptSettlementTerms, submitOverseasAnswers } from "@/services/creator/settlement";
import { MEMBER_TYPES, OVERSEAS_QUESTIONS, type MemberType, type ResidenceCountry } from "@/services/creator/settlementTypes";
import { TERM_TITLES, termsTextFor } from "./settlementTerms";
import styles from "./terms.module.css";

const COUNTRIES: { key: ResidenceCountry; label: string }[] = [
  { key: "KR", label: "대한민국" },
  { key: "OTHER", label: "대한민국 이외" }
];

/**
 * 이용동의 — Figma 429:139 · 443:257 · 433:138 · 437:338 (대한민국, by member type) and
 * 452:4 · 452:47 (대한민국 이외 questionnaire). 다음 records the consent on the server and opens the
 * member type's registration form. Where the overseas answers lead is not designed (TBD).
 */
export function SettlementTermsScreen({ initialType }: { initialType: MemberType }) {
  const router = useRouter();
  const [country, setCountry] = useState<ResidenceCountry>("KR");
  const [type, setType] = useState<MemberType>(initialType);
  const [agreed, setAgreed] = useState([false, false, false, false]);
  const [answers, setAnswers] = useState<(boolean | null)[]>(OVERSEAS_QUESTIONS.map(() => null));
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const allAgreed = agreed.every(Boolean);
  const allAnswered = answers.every((a) => a !== null);
  const canNext = country === "KR" ? allAgreed : allAnswered;

  const next = () => {
    setMessage(null);
    startTransition(async () => {
      if (country === "KR") {
        const res = await acceptSettlementTerms({ memberType: type, agreed });
        if (res.status === "ACCEPTED") router.push(`/creator/settlement/register/form?type=${res.memberType}`);
        else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/settlement/register");
        else setMessage({ tone: "error", text: res.message ?? "입력 내용을 확인해 주세요." });
        return;
      }
      const res = await submitOverseasAnswers(answers);
      if (res.status === "RECEIVED") {
        setMessage({ tone: "info", text: "대한민국 이외 거주자의 정산 등록은 준비 중입니다. 고객센터로 문의해 주세요." });
      } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/settlement/register");
      else setMessage({ tone: "error", text: res.message ?? "모든 질문에 답해 주세요." });
    });
  };

  const texts = termsTextFor(type);

  return (
    <div className={styles.page}>
      <section className={styles.modal} aria-labelledby="terms-title">
        <h1 id="terms-title" className={styles.title}>
          이용동의
        </h1>

        <fieldset className={styles.group}>
          <legend className={styles.groupLabel}>거주 국가 선택</legend>
          <div className={styles.choices}>
            {COUNTRIES.map((c) => (
              <button
                key={c.key}
                type="button"
                className={styles.choice}
                aria-pressed={country === c.key}
                onClick={() => {
                  setCountry(c.key);
                  setMessage(null);
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>

        {country === "KR" ? (
          <>
            <fieldset className={styles.group}>
              <legend className={styles.groupLabel}>회원 유형 선택</legend>
              <div className={`${styles.choices} ${styles.typeChoices}`}>
                {MEMBER_TYPES.map((t) => (
                  <button key={t.key} type="button" className={`${styles.choice} ${styles.typeChoice}`} aria-pressed={type === t.key} onClick={() => setType(t.key)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <hr className={styles.divider} />

            <section className={styles.agreements} aria-labelledby="terms-agree">
              <div className={styles.agreeHead}>
                <h2 id="terms-agree" className={styles.agreeTitle}>
                  썸네이션 서비스 이용 및 정산등록 동의
                </h2>
                <p className={styles.agreeLead}>정산 과정에 필요한 서비스 약관 및 개인정보 수집, 이용 동의에 동의해 주세요.</p>
              </div>

              <label className={`${styles.check} ${styles.checkAll}`}>
                <input type="checkbox" checked={allAgreed} onChange={(e) => setAgreed(agreed.map(() => e.target.checked))} />
                <span className={styles.checkMark} aria-hidden="true" />
                <span className={styles.checkAllLabel}>약관 전체 동의</span>
              </label>

              <ul className={styles.terms}>
                {TERM_TITLES.map((title, i) => (
                  <li key={title} className={styles.term}>
                    <label className={styles.check}>
                      <input type="checkbox" checked={agreed[i]} onChange={(e) => {
                          const checked = e.target.checked;
                          setAgreed((prev) => prev.map((a, j) => (j === i ? checked : a)));
                        }} />
                      <span className={styles.checkMark} aria-hidden="true" />
                      <span className={styles.checkLabel}>{title}</span>
                    </label>
                    <div className={styles.termBox} tabIndex={0} role="region" aria-label={`${title} 내용`}>
                      {texts[i]}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : (
          <ol className={styles.questions}>
            {OVERSEAS_QUESTIONS.map((q, i) => (
              <li key={q} className={styles.question}>
                <span className={styles.questionText} id={`overseas-q${i}`}>
                  {i + 1}. {q}
                </span>
                <span className={styles.answers} role="group" aria-labelledby={`overseas-q${i}`}>
                  {[true, false].map((yes) => (
                    <button
                      key={String(yes)}
                      type="button"
                      className={styles.answer}
                      aria-pressed={answers[i] === yes}
                      onClick={() => setAnswers((prev) => prev.map((a, j) => (j === i ? yes : a)))}
                    >
                      {yes ? "예" : "아니오"}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ol>
        )}

        {message && (
          <p className={message.tone === "error" ? styles.error : styles.info} role={message.tone === "error" ? "alert" : "status"}>
            {message.text}
          </p>
        )}

        <button type="button" className={styles.next} onClick={next} disabled={!canNext || pending} aria-busy={pending || undefined}>
          {pending ? "처리 중..." : "다음"}
        </button>
      </section>
    </div>
  );
}
