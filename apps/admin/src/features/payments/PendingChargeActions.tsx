"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { resolvePendingCharge } from "@/lib/actions";
import { formatNumber } from "@/lib/format";
import { CHARGE_RESOLVE_NOTE, type PendingChargeOutcome, type PendingChargeResolveResult, type PendingChargeResult } from "@/types/adminApi";
import styles from "../admin.module.css";

const failText = (res: Exclude<PendingChargeResolveResult, { status: "OK" }>) =>
  res.status === "INVALID" ? res.message : res.status === "NOT_FOUND" ? "충전을 찾을 수 없어요." : res.status === "UNAUTHORIZED" ? "관리자 로그인이 필요합니다." : "사이트에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.";

/** What the site says it did (also when the member withdrew after the list was read). */
const DONE: Record<PendingChargeResult, (amount: string) => string> = {
  CREDITED: (amount) => `결제 확인으로 정했어요. ${amount}을 지급했어요.`,
  NOT_CREDITED: () => "결제 확인으로 정했어요. 탈퇴한 회원이라 FN은 지급하지 않았어요.",
  CANCELLED: () => "결제 취소로 정했어요. FN은 지급하지 않았어요."
};

/**
 * 처리 중 충전 (2026-10-12 결정): 결제 확인 (FN 지급) / 결제 취소 (미지급) need a memo (operators only) and are final. 결제
 * 확인 of a member who has withdrawn credits nothing (`withdrawn`, 완료 · FN 미지급). One request id per intended decision,
 * so a retry after a lost response is recorded once; a new one when the memo changes.
 */
export function PendingChargeActions({ chargeId, fnAmount, withdrawn }: { chargeId: string; fnAmount: number; withdrawn: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);

  const decide = (outcome: PendingChargeOutcome) => {
    const amount = `${formatNumber(fnAmount)} FN`;
    const question =
      outcome === "CANCELLED"
        ? "결제 취소로 정할까요? FN을 지급하지 않고 충전은 취소로 끝나요. 되돌릴 수 없어요."
        : withdrawn
          ? `결제 확인으로 정할까요? 탈퇴한 회원의 충전이라 ${amount}을 지급하지 않아요 (완료 · FN 미지급). 되돌릴 수 없어요.`
          : `결제 확인으로 정할까요? 회원에게 ${amount}을 지급해요. 되돌릴 수 없어요.`;
    if (!window.confirm(question)) return;
    requestId.current ??= crypto.randomUUID();
    const input = { chargeId, outcome, note: note.trim(), requestId: requestId.current };
    setMsg(null);
    startTransition(async () => {
      let res: PendingChargeResolveResult;
      try {
        res = await resolvePendingCharge(input);
      } catch {
        res = { status: "UNAVAILABLE" };
      }
      if (res.status === "OK") {
        requestId.current = null;
        setMsg({ tone: "ok", text: DONE[res.result](amount) });
        router.refresh();
      } else {
        setMsg({ tone: "error", text: failText(res) });
        // Decided meanwhile (another operator): show the site's current state.
        if (res.status === "INVALID") router.refresh();
      }
    });
  };
  const ready = !pending && note.trim().length >= CHARGE_RESOLVE_NOTE.min;

  return (
    <div className={styles.form}>
      <textarea
        className={styles.textarea}
        rows={2}
        maxLength={CHARGE_RESOLVE_NOTE.max}
        placeholder="처리 메모 (필수, 운영자만 봐요) · 예: 결제 대행사 관리자 화면 확인 결과"
        aria-label="처리 메모"
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          requestId.current = null;
        }}
      />
      <div className={styles.filters}>
        <button type="button" className={styles.button} disabled={!ready} onClick={() => decide("COMPLETED")}>
          결제 확인 (FN 지급)
        </button>
        <button type="button" className={styles.danger} disabled={!ready} onClick={() => decide("CANCELLED")}>
          결제 취소 (미지급)
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
