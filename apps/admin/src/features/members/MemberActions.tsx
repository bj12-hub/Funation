"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { restoreMember, suspendMember } from "@/lib/actions";
import { SUSPEND_DAYS, SUSPEND_REASON, type ActionResult } from "@/types/adminApi";
import styles from "../admin.module.css";

/** 이용 정지 / 해제 — reason required; the server writes both to the audit log. */
export function MemberActions({ id, suspended }: { id: string; suspended: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [days, setDays] = useState<(typeof SUSPEND_DAYS)[number]>(7);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);

  const run = (action: () => Promise<ActionResult>, ok: string) => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "OK") {
          requestId.current = null;
          setReason("");
          setNote({ tone: "ok", text: ok });
          router.refresh();
        } else setNote({ tone: "error", text: res.status === "INVALID" ? res.message : res.status === "NOT_FOUND" ? "회원을 찾을 수 없어요." : res.status === "UNAUTHORIZED" ? "관리자 로그인이 필요합니다." : "사이트에 연결할 수 없어요. 잠시 후 다시 시도해 주세요." });
      } catch {
        setNote({ tone: "error", text: "처리하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };
  const suspend = () => {
    if (!window.confirm(days === null ? "이 회원을 영구 정지할까요? 영구 정지된 회원의 남은 FN은 회원 요청에 따라 운영자가 정리해요." : `이 회원을 ${days}일 정지할까요?`)) return;
    requestId.current ??= crypto.randomUUID();
    run(() => suspendMember({ id, days, reason, requestId: requestId.current }), "이용을 정지했어요.");
  };

  return (
    <div className={styles.form}>
      {!suspended && (
        <div className={styles.segment} role="radiogroup" aria-label="정지 기간">
          {SUSPEND_DAYS.map((d) => (
            <button
              key={String(d)}
              type="button"
              role="radio"
              aria-checked={days === d}
              className={styles.segmentItem}
              onClick={() => {
                setDays(d);
                // Another period is another request (the site refuses a reused id with a different period or reason).
                if (d !== days) requestId.current = null;
              }}
            >
              {d === null ? "영구" : `${d}일`}
            </button>
          ))}
        </div>
      )}
      <textarea
        className={styles.textarea}
        rows={3}
        maxLength={SUSPEND_REASON.max}
        placeholder={suspended ? "해제 사유 (필수)" : "정지 사유 (필수, 회원에게 안내될 수 있어요)"}
        aria-label={suspended ? "해제 사유" : "정지 사유"}
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          // Another reason is another request, as in FnSettlementAction and HoldControl.
          requestId.current = null;
        }}
      />
      {suspended ? (
        <button type="button" className={styles.button} disabled={pending || reason.trim().length < SUSPEND_REASON.min} onClick={() => run(() => restoreMember({ id, reason }), "정지를 해제했어요.")}>
          {pending ? "처리 중…" : "정지 해제"}
        </button>
      ) : (
        <button type="button" className={styles.danger} disabled={pending || reason.trim().length < SUSPEND_REASON.min} onClick={suspend}>
          {pending ? "처리 중…" : "이용 정지"}
        </button>
      )}
      {note && (
        <p className={note.tone === "error" ? styles.error : styles.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
    </div>
  );
}
