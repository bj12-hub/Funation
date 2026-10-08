"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideReport } from "@/lib/actions";
import { runAction } from "@/lib/runAction";
import { REPORT_NOTE } from "@/types/adminApi";
import styles from "../admin.module.css";

/** 숨김 / 기각 — memo required, final, audited on the site. */
export function ReportDecision({ id, canHide }: { id: string; canHide: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const decide = (action: "HIDE" | "DISMISS") => {
    if (!window.confirm(action === "HIDE" ? "콘텐츠를 사이트에서 숨길까요? 같은 콘텐츠의 신고가 모두 닫혀요." : "신고를 기각할까요? 같은 내용에 대한 다른 신고도 함께 기각돼요. 내용이 바뀐 뒤 들어온 신고는 따로 처리해요.")) return;
    setMsg(null);
    startTransition(async () => {
      const res = await runAction(() => decideReport({ id, action, note }));
      if (res.status === "OK") {
        setMsg({ tone: "ok", text: action === "HIDE" ? "숨김 처리했어요." : "기각했어요." });
        router.refresh();
      } else
        setMsg({
          tone: "error",
          text: res.status === "INVALID" ? res.message : res.status === "NOT_FOUND" ? "신고를 찾을 수 없어요." : res.status === "UNAUTHORIZED" ? "관리자 로그인이 필요합니다." : "사이트에 연결할 수 없어요. 잠시 후 다시 시도해 주세요."
        });
    });
  };
  const ready = !pending && note.trim().length >= REPORT_NOTE.min;

  return (
    <div className={styles.form}>
      <textarea className={styles.textarea} rows={2} maxLength={REPORT_NOTE.max} placeholder="처리 메모 (필수)" aria-label="처리 메모" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className={styles.filters}>
        {canHide ? (
          <button type="button" className={styles.danger} disabled={!ready} onClick={() => decide("HIDE")}>
            콘텐츠 숨김
          </button>
        ) : (
          <span className={styles.muted}>채널은 숨길 수 없어요 — 필요하면 회원 관리에서 이용 정지해 주세요.</span>
        )}
        <button type="button" className={styles.button} disabled={!ready} onClick={() => decide("DISMISS")}>
          기각
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
