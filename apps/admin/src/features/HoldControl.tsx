"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { holdRefund, holdSettlement } from "@/lib/actions";
import { runAction } from "@/lib/runAction";
import { HOLD_NOTE, type ActionResult, type HoldAction } from "@/types/adminApi";
import styles from "./admin.module.css";

/** What is put on 보류: a settlement request (정산 심사) or a charge refund request (결제 · 환불). */
export type HoldTarget = { kind: "settlement"; id: string } | { kind: "refund"; chargeId: string };

const QUESTION: Record<HoldTarget["kind"], Record<HoldAction, string>> = {
  settlement: {
    HOLD: "이 정산을 보류할까요? 보류를 해제할 때까지 승인 · 반려 · 지급 완료를 할 수 없어요. 크리에이터 화면은 그대로예요.",
    RELEASE: "보류를 해제할까요? 보류 전 상태로 돌아가 다시 처리할 수 있어요."
  },
  refund: {
    HOLD: "이 환불 요청을 보류할까요? 보류를 해제할 때까지 승인 · 거절을 할 수 없어요. 회원 화면은 그대로 심사 중이에요.",
    RELEASE: "보류를 해제할까요? 보류 전 상태로 돌아가 다시 처리할 수 있어요."
  }
};

/** The console's message for a failed hold call. */
const holdErrorText = (res: Exclude<ActionResult, { status: "OK" }>) =>
  res.status === "INVALID" ? res.message : res.status === "NOT_FOUND" ? "요청을 찾을 수 없어요." : res.status === "UNAUTHORIZED" ? "관리자 로그인이 필요합니다." : "사이트에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.";

/**
 * 보류 / 보류 해제 (2026-10-08 결정): an operator flag with a required memo (operators only), audited on the site. While
 * a request is held the site refuses 승인 · 반려 · 거절 · 지급 완료; 보류 해제 puts it back as it was. One request id per
 * intended action (a retry after a lost response is recorded once); a new one once the memo changes.
 */
export function HoldControl({ target, held }: { target: HoldTarget; held: boolean }) {
  const router = useRouter();
  const action: HoldAction = held ? "RELEASE" : "HOLD";
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);

  const run = () => {
    if (!window.confirm(QUESTION[target.kind][action])) return;
    requestId.current ??= crypto.randomUUID();
    const input = { action, note: note.trim(), requestId: requestId.current };
    setMsg(null);
    startTransition(async () => {
      const res = await runAction(() => (target.kind === "settlement" ? holdSettlement({ ...input, id: target.id }) : holdRefund({ ...input, chargeId: target.chargeId })));
      if (res.status === "OK") {
        requestId.current = null;
        setNote("");
        setMsg({ tone: "ok", text: action === "HOLD" ? "보류했어요." : "보류를 해제했어요." });
        router.refresh();
      } else {
        setMsg({ tone: "error", text: holdErrorText(res) });
        // Another operator may have changed it meanwhile: show the site's current state.
        if (res.status === "INVALID") router.refresh();
      }
    });
  };
  const label = held ? "보류 해제" : "보류";
  const ready = !pending && note.trim().length >= HOLD_NOTE.min;

  return (
    <div className={styles.form}>
      <div className={styles.filters}>
        <input
          className={styles.input}
          aria-label={`${label} 메모`}
          placeholder={held ? "보류 해제 메모 (필수, 운영자만 봐요)" : "보류 메모 (필수, 운영자만 봐요)"}
          maxLength={HOLD_NOTE.max}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            requestId.current = null;
          }}
        />
        <button type="button" className={styles.button} disabled={!ready} onClick={run}>
          {label}
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
