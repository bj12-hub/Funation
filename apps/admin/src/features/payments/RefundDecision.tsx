"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideRefund } from "@/lib/actions";
import { formatNumber } from "@/lib/format";
import { REFUND_NOTE, type RefundQuote } from "@/types/adminApi";
import styles from "../admin.module.css";

/**
 * 환불 승인 / 거절 — a memo is required; the decision is final and written to the audit log. 승인 applies `current`, the
 * refund the site recomputed for this request (환불 정책 기본값): it sends that amount, and if the member used FN since,
 * the site refuses with the new amount and the card refreshes to show it. Nothing left to refund: only 거절.
 */
export function RefundDecision({ chargeId, current }: { chargeId: string; current: RefundQuote | null }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const refundable = current !== null && current.type !== "NOT_REFUNDABLE";

  const decide = (decision: "APPROVE" | "REJECT") => {
    const question =
      decision === "APPROVE" && current
        ? `환불을 승인할까요? ${formatNumber(current.grossFn)} FN을 회수하고 ${formatNumber(current.netFn)} FN을 환불해요(수수료 ${formatNumber(current.feeFn)} FN). 되돌릴 수 없어요.`
        : "환불 요청을 거절할까요?";
    if (!window.confirm(question)) return;
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await decideRefund({ chargeId, decision, note, ...(decision === "APPROVE" && current ? { expectedGrossFn: current.grossFn, expectedNetFn: current.netFn } : {}) });
        if (res.status === "OK") {
          setMsg({ tone: "ok", text: decision === "APPROVE" ? "승인했어요." : "거절했어요." });
          router.refresh();
        } else {
          setMsg({ tone: "error", text: res.status === "INVALID" ? res.message : res.status === "NOT_FOUND" ? "요청을 찾을 수 없어요." : res.status === "UNAUTHORIZED" ? "관리자 로그인이 필요합니다." : "사이트에 연결할 수 없어요. 잠시 후 다시 시도해 주세요." });
          // The amount may have changed (FN used since): show the site's current one.
          if (res.status === "INVALID") router.refresh();
        }
      } catch {
        setMsg({ tone: "error", text: "처리하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };
  const ready = !pending && note.trim().length >= REFUND_NOTE.min;

  return (
    <div className={styles.form}>
      <textarea className={styles.textarea} rows={2} maxLength={REFUND_NOTE.max} placeholder="처리 메모 (필수, 거절 시 회원에게 안내돼요)" aria-label="처리 메모" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className={styles.filters}>
        <button type="button" className={styles.button} disabled={!ready || !refundable} onClick={() => decide("APPROVE")}>
          승인
        </button>
        <button type="button" className={styles.danger} disabled={!ready} onClick={() => decide("REJECT")}>
          거절
        </button>
      </div>
      {!refundable && <p className={styles.muted}>지금은 환불할 FN이 없어 승인할 수 없어요. 거절로 처리해 주세요.</p>}
      {pending && (
        <p className={styles.muted} role="status">
          처리 중…
        </p>
      )}
      {msg && (
        <p className={msg.tone === "error" ? styles.error : styles.ok} role={msg.tone === "error" ? "alert" : "status"}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
