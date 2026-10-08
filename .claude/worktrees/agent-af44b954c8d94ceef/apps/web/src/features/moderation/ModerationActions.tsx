"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { blockAuthorOf, submitReport } from "@/services/moderation/moderation";
import { REPORT_DETAIL_MAX, REPORT_REASONS, REPORT_TARGET_LABEL, type ReportReason, type ReportTarget } from "@/services/moderation/moderationTypes";
import { carryToast } from "./CarriedToast";
import styles from "./moderation.module.css";

/**
 * 신고 · 차단 버튼 (code-first, no Figma frame). `target` points at the content; the server resolves its
 * author, so author ids never reach the browser. `block` adds "작성자 차단" (hidden for creator channels
 * where the room's own actions apply). `leaveTo`: where to go after a block when the page itself disappears for the
 * member (a post's own page); the block toast shows there.
 */
export function ModerationActions({
  target,
  signedIn,
  block = true,
  leaveTo,
  className
}: {
  target: ReportTarget;
  signedIn: boolean;
  block?: boolean;
  leaveTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const clearToast = useCallback(() => setToast(null), []);

  const needLogin = () => {
    if (signedIn) return false;
    router.push(`/login?next=${encodeURIComponent(pathname)}`);
    return true;
  };
  const report = () => {
    if (!reason) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await submitReport({ target, reason, detail });
        if (res.status === "REPORTED" || res.status === "ALREADY_REPORTED") {
          setOpen(false);
          setReason(null);
          setDetail("");
          setToast(res.status === "REPORTED" ? "신고가 접수됐어요. 운영팀이 확인할게요." : "이미 신고한 내용이에요.");
        } else if (res.status === "UNAUTHORIZED") needLogin();
        else setError(res.status === "INVALID" ? res.message : "이미 삭제된 내용이에요.");
      } catch {
        setError("신고하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    });
  };
  const blockAuthor = () => {
    if (needLogin() || !window.confirm("작성자를 차단할까요? 차단한 사용자의 글 · 댓글 · 쪽지가 보이지 않아요. 마이페이지 › 차단 관리에서 해제할 수 있어요.")) return;
    startTransition(async () => {
      try {
        const res = await blockAuthorOf({ target });
        if (res.status === "OK") {
          const message = `${res.name}님을 차단했어요.`;
          if (leaveTo) {
            carryToast(message);
            router.push(leaveTo);
          } else {
            setToast(message);
            router.refresh();
          }
        } else if (res.status === "UNAUTHORIZED") needLogin();
        else setToast(res.status === "INVALID" ? res.message : "이미 삭제된 내용이에요.");
      } catch {
        setToast("차단하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    });
  };

  return (
    <span className={`${styles.actions} ${className ?? ""}`}>
      <button type="button" className={styles.link} onClick={() => !needLogin() && setOpen(true)} disabled={pending}>
        신고
      </button>
      {block && (
        <button type="button" className={styles.link} onClick={blockAuthor} disabled={pending}>
          차단
        </button>
      )}
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={`${REPORT_TARGET_LABEL[target.type]} 신고`}
        description="신고 내용은 운영팀만 볼 수 있고, 신고한 사람은 상대에게 알려지지 않아요. 처리 기준은 운영 정책에 따라요 (TBD)."
        width={480}
        footer={
          <>
            <Button variant="secondary" block onClick={() => setOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button variant="primary" block onClick={report} disabled={pending || !reason}>
              {pending ? "접수 중…" : "신고하기"}
            </Button>
          </>
        }
      >
        <div className={styles.reasons} role="radiogroup" aria-label="신고 사유">
          {REPORT_REASONS.map((r) => (
            <label key={r.key} className={styles.reason}>
              <input type="radio" name="report-reason" checked={reason === r.key} onChange={() => setReason(r.key)} />
              {r.label}
            </label>
          ))}
        </div>
        <textarea
          className={styles.detail}
          rows={3}
          maxLength={REPORT_DETAIL_MAX}
          aria-label="상세 내용"
          placeholder={reason === "ETC" ? "신고 사유를 적어 주세요 (필수)" : "상세 내용 (선택)"}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
        />
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </Modal>
      <Toast message={toast} tone="neutral" onDone={clearToast} />
    </span>
  );
}
