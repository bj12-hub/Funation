"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { SettlementChecklist as Checklist } from "@/services/creator/settlementTypes";
import { REVIEW_KEY } from "./settlementLabels";
import styles from "./settlement.module.css";

type Step = { label: string; done: boolean; status: string; href?: string; action?: string };

/**
 * 정산 준비 체크리스트 — code-first (no Figma frame). Shows which steps are left before a settlement
 * request (reference: docs/research/funnation-reference.md P1-4). Server values only.
 */
export function SettlementChecklist({ checklist }: { checklist: Checklist }) {
  const { t } = useI18n();
  const steps: Step[] = [
    {
      label: t("studioSettlement.checkIdentity"),
      done: checklist.identityVerified,
      status: checklist.identityVerified ? t("studioSettlement.checkDone") : t("studioSettlement.checkNeeded"),
      href: "/mypage",
      action: t("studioSettlement.actionVerify")
    },
    {
      label: t("studioSettlement.checkDocuments"),
      done: checklist.documentsSubmitted,
      status: checklist.documentsSubmitted ? t("studioSettlement.checkSubmitted") : t("studioSettlement.checkNotSubmitted"),
      href: "/creator/settlement/register",
      action: t("studioSettlement.actionRegister")
    },
    { label: t("studioSettlement.checkReview"), done: checklist.review === "APPROVED", status: t(REVIEW_KEY[checklist.review]) },
    {
      label: t("studioSettlement.checkAccount"),
      done: checklist.bankRegistered,
      status: checklist.bankRegistered ? t("studioSettlement.checkRegistered") : t("studioSettlement.checkUnregistered")
    }
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section className={styles.checklist} aria-labelledby="settle-checklist">
      <div className={styles.checklistHead}>
        <h2 id="settle-checklist" className={styles.startTitle}>
          {t("studioSettlement.checklistTitle")}
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
        {checklist.ready ? t("studioSettlement.checklistReady") : t("studioSettlement.checklistPending")} {t("studioSettlement.checklistReviewTbd")}
      </p>
    </section>
  );
}
