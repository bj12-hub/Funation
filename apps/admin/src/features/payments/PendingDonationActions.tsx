"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { checkPendingDonation, resolvePendingDonation } from "@/lib/actions";
import { formatNumber } from "@/lib/format";
import { runAction } from "@/lib/runAction";
import { RESOLVE_NOTE, type ActionResult, type PendingCheckResult, type PendingDonationOutcome } from "@/types/adminApi";
import styles from "../admin.module.css";

const failText = (res: Exclude<ActionResult, { status: "OK" }>) =>
  res.status === "INVALID" ? res.message : res.status === "NOT_FOUND" ? "후원을 찾을 수 없어요." : res.status === "UNAUTHORIZED" ? "관리자 로그인이 필요합니다." : "사이트에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.";

/** What 다시 확인 found. */
const CHECKED: Record<PendingDonationOutcome | "UNKNOWN", string> = {
  COMPLETED: "플랫폼에서 완료를 확인했어요.",
  FAILED: "플랫폼에서 실패를 확인했어요.",
  UNKNOWN: "아직 플랫폼 결과가 없어요. 플랫폼에서 확인한 뒤 성공 또는 실패로 정해 주세요."
};

/**
 * 확인 중 후원 (2026-10-08 결정): 다시 확인 asks the platform now; 성공 / 실패 need a memo (operators only) and are final.
 * 실패 returns the held FN — not for a member who has withdrawn since (the FN are forfeited, `withdrawn`). One request id
 * per intended decision, so a retry after a lost response is recorded once; a new one when the memo changes.
 */
export function PendingDonationActions({ transactionId, fnAmount, withdrawn }: { transactionId: string; fnAmount: number; withdrawn: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);

  const check = () => {
    setMsg(null);
    startTransition(async () => {
      let res: PendingCheckResult;
      try {
        res = await checkPendingDonation(transactionId);
      } catch {
        res = { status: "UNAVAILABLE" };
      }
      if (res.status === "OK") {
        setMsg({ tone: "ok", text: CHECKED[res.outcome] });
        if (res.outcome !== "UNKNOWN") router.refresh();
      } else {
        setMsg({ tone: "error", text: failText(res) });
        if (res.status === "INVALID") router.refresh();
      }
    });
  };

  const decide = (outcome: PendingDonationOutcome) => {
    const amount = `${formatNumber(fnAmount)} FN`;
    const question =
      outcome === "COMPLETED"
        ? `후원을 성공으로 정할까요? 보관 중인 ${amount}은 사용한 것으로 처리돼요. 되돌릴 수 없어요.`
        : withdrawn
          ? `후원을 실패로 정할까요? 탈퇴한 회원의 후원이라 ${amount}을 돌려주지 않아요(소멸). 되돌릴 수 없어요.`
          : `후원을 실패로 정할까요? 보관 중인 ${amount}을 회원에게 돌려줘요. 되돌릴 수 없어요.`;
    if (!window.confirm(question)) return;
    requestId.current ??= crypto.randomUUID();
    const input = { transactionId, outcome, note: note.trim(), requestId: requestId.current };
    setMsg(null);
    startTransition(async () => {
      const res = await runAction(() => resolvePendingDonation(input));
      if (res.status === "OK") {
        requestId.current = null;
        setMsg({ tone: "ok", text: outcome === "COMPLETED" ? "성공으로 정했어요." : withdrawn ? "실패로 정했어요. 탈퇴한 회원이라 FN은 돌려주지 않았어요." : "실패로 정했어요. FN을 돌려줬어요." });
        router.refresh();
      } else {
        setMsg({ tone: "error", text: failText(res) });
        // Settled meanwhile (다시 확인, another operator): show the site's current state.
        if (res.status === "INVALID") router.refresh();
      }
    });
  };
  const ready = !pending && note.trim().length >= RESOLVE_NOTE.min;

  return (
    <div className={styles.form}>
      <div className={styles.filters}>
        <button type="button" className={styles.button} disabled={pending} onClick={check}>
          다시 확인
        </button>
      </div>
      <textarea
        className={styles.textarea}
        rows={2}
        maxLength={RESOLVE_NOTE.max}
        placeholder="처리 메모 (필수, 운영자만 봐요) · 예: 플랫폼 고객센터 확인 결과"
        aria-label="처리 메모"
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          requestId.current = null;
        }}
      />
      <div className={styles.filters}>
        <button type="button" className={styles.button} disabled={!ready} onClick={() => decide("COMPLETED")}>
          성공
        </button>
        <button type="button" className={styles.danger} disabled={!ready} onClick={() => decide("FAILED")}>
          실패
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
