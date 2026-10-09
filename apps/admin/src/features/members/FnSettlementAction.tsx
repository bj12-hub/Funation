"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { settleMemberFn } from "@/lib/actions";
import { formatNumber } from "@/lib/format";
import { FN_SETTLE_NOTE, type MemberFnSettlement } from "@/types/adminApi";
import styles from "../admin.module.css";

/**
 * 남은 FN 정리 — "환불 처리 및 FN 정리" with a required memo and a confirm dialog (code-first, 2026-10-08 결정). It sends
 * the totals the card shows; the site refuses them if they changed, and the card refreshes to the site's current amounts.
 * One request id per intended 정리, so a retry after a lost answer is processed once. DISABLED unless the site says READY.
 */
export function FnSettlementAction({ id, plan }: { id: string; plan: MemberFnSettlement }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);
  const ready = plan.status === "READY";

  const settle = () => {
    const t = plan.total;
    const refund = plan.lines.length > 0 ? `유상 FN ${formatNumber(t.grossFn)} FN을 회수해 ${formatNumber(t.netFn)} FN(${formatNumber(t.refundKrw)}원)을 환불하고` : "환불할 유상 FN은 없고";
    if (!window.confirm(`남은 FN을 정리할까요? ${refund}, 무상 FN ${formatNumber(plan.forfeitFn)} FN은 소멸돼요. 보유 FN이 0이 되며 되돌릴 수 없어요.`)) return;
    requestId.current ??= crypto.randomUUID();
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await settleMemberFn({
          id,
          note,
          requestId: requestId.current,
          expectedGrossFn: t.grossFn,
          expectedNetFn: t.netFn,
          expectedRefundKrw: t.refundKrw,
          expectedForfeitFn: plan.forfeitFn
        });
        if (res.status === "OK") {
          requestId.current = null;
          setNote("");
          setMsg({ tone: "ok", text: "남은 FN을 정리했어요." });
          router.refresh();
        } else {
          setMsg({ tone: "error", text: res.status === "INVALID" ? res.message : res.status === "NOT_FOUND" ? "회원을 찾을 수 없어요." : res.status === "UNAUTHORIZED" ? "관리자 로그인이 필요합니다." : "사이트에 연결할 수 없어요. 잠시 후 다시 시도해 주세요." });
          // The site answered: a new 정리 needs a new id, and the card shows the site's current amounts.
          if (res.status === "INVALID") {
            requestId.current = null;
            router.refresh();
          }
        }
      } catch {
        setMsg({ tone: "error", text: "처리하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };

  return (
    <div className={styles.form}>
      <textarea
        className={styles.textarea}
        rows={2}
        maxLength={FN_SETTLE_NOTE.max}
        placeholder="처리 메모 (필수, 회원 요청 내용 등)"
        aria-label="남은 FN 정리 메모"
        value={note}
        disabled={!ready}
        onChange={(e) => {
          setNote(e.target.value);
          // Another memo is another request (the site refuses a reused id with a different memo), as in HoldControl.
          requestId.current = null;
        }}
      />
      <button type="button" className={styles.danger} disabled={!ready || pending || note.trim().length < FN_SETTLE_NOTE.min} onClick={settle}>
        {pending ? "처리 중…" : "환불 처리 및 FN 정리"}
      </button>
      {msg && (
        <p className={msg.tone === "error" ? styles.error : styles.ok} role={msg.tone === "error" ? "alert" : "status"}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
