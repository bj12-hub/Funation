"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { FLEXTV_REPORT_BODY_MAX } from "@/lib/flextv/rules";
import { flextvReportCategories, reportFlextvBroadcast } from "@/services/moderation/flextvReport";
import type { FlextvReportCategory } from "@/services/moderation/flextvReportTypes";
import styles from "./moderation.module.css";

const newRequestId = () => crypto.randomUUID();

/**
 * 방송 신고 in a FLEXTV channel's room (phase 10, code-first): FLEXTV's 신고 유형 and 내용, sent to FLEXTV's operators as
 * its own 신고 form does. One request id per opened form, so a double click is one 신고.
 */
export function FlextvReportButton({ channelId, signedIn, className }: { channelId: string; signedIn: boolean; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<FlextvReportCategory[] | null | "LOADING">("LOADING");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [requestId, setRequestId] = useState(newRequestId);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const clearToast = useCallback(() => setToast(null), []);
  const login = () => router.push(`/login?next=${encodeURIComponent(pathname)}`);

  const show = () => {
    if (!signedIn) return login();
    setOpen(true);
    setError(null);
    if (categories === "LOADING" || categories === null) {
      setCategories("LOADING");
      flextvReportCategories()
        .then(setCategories)
        .catch(() => setCategories(null));
    }
  };
  const submit = () =>
    startTransition(async () => {
      setError(null);
      try {
        const res = await reportFlextvBroadcast({ channelId, category, content, requestId });
        if (res.status === "REPORTED") {
          setOpen(false);
          setCategory("");
          setContent("");
          setRequestId(newRequestId());
          setToast("신고가 접수됐어요. FLEXTV 운영팀이 확인해요.");
        } else if (res.status === "UNAUTHORIZED") login();
        else setError(res.message);
      } catch {
        setError("신고하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    });

  return (
    <span className={`${styles.actions} ${className ?? ""}`}>
      <button type="button" className={styles.link} onClick={show} disabled={pending}>
        신고
      </button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="방송 신고"
        description="이 방송에 문제가 있으면 알려 주세요. FLEXTV 운영팀이 확인하고, 답변은 FLEXTV 신고 내역에서 볼 수 있어요."
        width={480}
        footer={
          <>
            <Button variant="secondary" block onClick={() => setOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button variant="primary" block onClick={submit} disabled={pending || !category || !content.trim()}>
              {pending ? "접수 중…" : "신고하기"}
            </Button>
          </>
        }
      >
        {categories === "LOADING" ? (
          <p className={styles.muted}>신고 유형을 불러오는 중이에요…</p>
        ) : categories === null ? (
          <p className={styles.error} role="alert">
            신고 유형을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
          </p>
        ) : (
          <div className={styles.reasons} role="radiogroup" aria-label="신고 유형">
            {categories.map((c) => (
              <label key={c.value} className={styles.reason}>
                <input type="radio" name="flextv-report-category" checked={category === c.value} onChange={() => setCategory(c.value)} />
                {c.label}
              </label>
            ))}
          </div>
        )}
        <textarea
          className={styles.detail}
          rows={4}
          maxLength={FLEXTV_REPORT_BODY_MAX}
          aria-label="신고 내용"
          placeholder="어떤 문제인지 적어 주세요 (필수)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
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
