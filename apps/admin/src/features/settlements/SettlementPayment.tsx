"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { paySettlement } from "@/lib/actions";
import { runAction } from "@/lib/runAction";
import { SETTLEMENT_REFERENCE } from "@/types/adminApi";
import styles from "../admin.module.css";

/**
 * 지급 완료 (2026-10-08 결정): records the transfer of an approved request with its 이체 참조번호 — final and audited on the
 * site. One request id per intended payment (a retry after a lost response is recorded once); a new one once the
 * reference changes. 지급 수단 · 일정 are TBD: nothing is transferred from here.
 */
export function SettlementPayment({ id }: { id: string }) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);

  const pay = () => {
    const ref = reference.trim();
    if (!window.confirm(`지급 완료로 처리할까요? 이체 참조번호 ${ref}(으)로 기록되고 되돌릴 수 없어요.`)) return;
    requestId.current ??= crypto.randomUUID();
    const rid = requestId.current;
    setMsg(null);
    startTransition(async () => {
      const res = await runAction(() => paySettlement({ id, reference: ref, requestId: rid }));
      if (res.status === "OK") {
        requestId.current = null;
        setMsg({ tone: "ok", text: "지급 완료로 처리했어요." });
        router.refresh();
      } else
        setMsg({
          tone: "error",
          text: res.status === "INVALID" ? res.message : res.status === "NOT_FOUND" ? "신청을 찾을 수 없어요." : res.status === "UNAUTHORIZED" ? "관리자 로그인이 필요합니다." : "사이트에 연결할 수 없어요. 잠시 후 다시 시도해 주세요."
        });
    });
  };
  const ready = !pending && reference.trim().length >= SETTLEMENT_REFERENCE.min;

  return (
    <div className={styles.form}>
      <div className={styles.filters}>
        <input
          className={styles.input}
          aria-label="이체 참조번호"
          placeholder="이체 참조번호 (계좌번호 말고 이체 건의 번호)"
          maxLength={SETTLEMENT_REFERENCE.max}
          value={reference}
          onChange={(e) => {
            setReference(e.target.value);
            requestId.current = null;
          }}
        />
        <button type="button" className={styles.button} disabled={!ready} onClick={pay}>
          지급 완료 처리
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
