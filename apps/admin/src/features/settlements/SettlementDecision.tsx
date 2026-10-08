"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideSettlement } from "@/lib/actions";
import { SETTLEMENT_NOTE } from "@/types/adminApi";
import styles from "../admin.module.css";

/**
 * 정산 승인 / 반려 — memo required, final, audited. Rejecting returns the amount to the creator.
 * `canApprove` is false when the request has no 신청 시점 정산 정보; the site refuses approval anyway.
 */
export function SettlementDecision({ id, canApprove }: { id: string; canApprove: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const decide = (decision: "APPROVE" | "REJECT") => {
    if (!window.confirm(decision === "APPROVE" ? "정산을 승인할까요? 지급 예정일에 지급 대상이 돼요." : "정산을 반려할까요? 신청 금액이 크리에이터에게 돌아가요.")) return;
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await decideSettlement({ id, decision, note });
        if (res.status === "OK") {
          setMsg({ tone: "ok", text: decision === "APPROVE" ? "승인했어요." : "반려했어요." });
          router.refresh();
        } else setMsg({ tone: "error", text: res.status === "INVALID" ? res.message : res.status === "NOT_FOUND" ? "신청을 찾을 수 없어요." : res.status === "UNAUTHORIZED" ? "관리자 로그인이 필요합니다." : "사이트에 연결할 수 없어요. 잠시 후 다시 시도해 주세요." });
      } catch {
        setMsg({ tone: "error", text: "처리하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };
  const ready = !pending && note.trim().length >= SETTLEMENT_NOTE.min;

  return (
    <div className={styles.form}>
      <textarea className={styles.textarea} rows={2} maxLength={SETTLEMENT_NOTE.max} placeholder="처리 메모 (필수, 반려 사유는 크리에이터에게 보여요)" aria-label="처리 메모" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className={styles.filters}>
        <button type="button" className={styles.button} disabled={!ready || !canApprove} onClick={() => decide("APPROVE")}>
          승인
        </button>
        <button type="button" className={styles.danger} disabled={!ready} onClick={() => decide("REJECT")}>
          반려
        </button>
      </div>
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
