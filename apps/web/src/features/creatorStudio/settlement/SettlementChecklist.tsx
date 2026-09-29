import Link from "next/link";
import { REVIEW_LABEL, type SettlementChecklist as Checklist } from "@/services/creator/settlementTypes";
import styles from "./settlement.module.css";

type Step = { label: string; done: boolean; status: string; href?: string; action?: string };

/**
 * 정산 준비 체크리스트 — code-first (no Figma frame). Shows which steps are left before a settlement
 * request (reference: docs/research/funnation-reference.md P1-4). Server values only.
 */
export function SettlementChecklist({ checklist }: { checklist: Checklist }) {
  const steps: Step[] = [
    { label: "본인인증", done: checklist.identityVerified, status: checklist.identityVerified ? "완료" : "필요", href: "/mypage", action: "마이페이지에서 인증" },
    {
      label: "정산 자료 등록",
      done: checklist.documentsSubmitted,
      status: checklist.documentsSubmitted ? "제출 완료" : "미제출",
      href: "/creator/settlement/register",
      action: "정산 등록하기"
    },
    { label: "서류 심사", done: checklist.review === "APPROVED", status: REVIEW_LABEL[checklist.review] },
    { label: "정산 계좌", done: checklist.bankRegistered, status: checklist.bankRegistered ? "등록됨" : "미등록" }
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section className={styles.checklist} aria-labelledby="settle-checklist">
      <div className={styles.checklistHead}>
        <h2 id="settle-checklist" className={styles.startTitle}>
          정산 준비 체크리스트
        </h2>
        <span className={styles.checklistCount}>
          {doneCount} / {steps.length}
        </span>
      </div>
      <ol className={styles.checklistSteps}>
        {steps.map((s, i) => (
          <li key={s.label} data-done={s.done || undefined}>
            <span className={styles.checklistMark} aria-hidden="true">
              {s.done ? "✓" : i + 1}
            </span>
            <span className={styles.checklistText}>
              <strong>{s.label}</strong>
              <span>{s.status}</span>
            </span>
            {!s.done && s.href && (
              <Link href={s.href} className={styles.checklistAction}>
                {s.action}
              </Link>
            )}
          </li>
        ))}
      </ol>
      <p className={styles.checklistNote}>
        {checklist.ready ? "모든 준비가 끝났어요. 정산 신청을 할 수 있어요." : "모든 단계를 완료하면 정산 신청을 할 수 있어요."} 서류 심사 절차는 아직 정해지지 않아 제출하면 바로 승인으로 표시돼요(TBD).
      </p>
    </section>
  );
}
