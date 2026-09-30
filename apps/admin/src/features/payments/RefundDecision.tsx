"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideRefund } from "@/lib/actions";
import { REFUND_NOTE } from "@/types/adminApi";
import styles from "../admin.module.css";

/** 환불 승인 / 거절 — a memo is required; the decision is final and written to the audit log. */
export function RefundDecision({ chargeId }: { chargeId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const decide = (decision: "APPROVE" | "REJECT") => {
    if (!window.confirm(decision === "APPROVE" ? "환불을 승인할까요? 충전 FN이 회수되고 되돌릴 수 없어요." : "환불 요청을 거절할까요?")) return;
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await decideRefund({ chargeId, decision, note });
        if (res.status === "OK") {
          setMsg({ tone: "ok", text: decision === "APPROVE" ? "승인했어요." : "거절했어요." });
          router.refresh();
        } else setMsg({ tone: "error", text: res.status === "INVALID" ? res.message : res.status === "NOT_FOUND" ? "요청을 찾을 수 없어요." : "관리자 로그인이 필요합니다." });
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
        <button type="button" className={styles.button} disabled={!ready} onClick={() => decide("APPROVE")}>
          승인
        </button>
        <button type="button" className={styles.danger} disabled={!ready} onClick={() => decide("REJECT")}>
          거절
        </button>
      </div>
      {msg && (
        <p className={msg.tone === "error" ? styles.error : styles.ok} role={msg.tone === "error" ? "alert" : "status"}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
