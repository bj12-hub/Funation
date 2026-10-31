"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { blockAuthorOf, submitReport } from "@/services/moderation/moderation";
import { REPORT_DETAIL_MAX, REPORT_REASONS, type ReportReason, type ReportTarget } from "@/services/moderation/moderationTypes";
import { carryToast } from "./CarriedToast";
import styles from "./moderation.module.css";

/** `REPORT_TARGET_LABEL` and `REPORT_REASONS` labels as message keys (2026-11-01). */
const TARGET_KEY: Record<ReportTarget["type"], MessageKey> = {
  POST: "moderation.targetPost",
  COMMENT: "moderation.targetComment",
  CHANNEL_POST: "moderation.targetChannelPost",
  MESSAGE: "moderation.targetMessage",
  CREATOR: "moderation.targetCreator"
};
const REASON_KEY: Record<ReportReason, MessageKey> = {
  SPAM: "moderation.reasonSpam",
  ABUSE: "moderation.reasonAbuse",
  SEXUAL: "moderation.reasonSexual",
  PRIVACY: "moderation.reasonPrivacy",
  IMPERSONATION: "moderation.reasonImpersonation",
  ETC: "moderation.reasonEtc"
};

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
  const { t } = useI18n();
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
          setToast(res.status === "REPORTED" ? t("moderation.reported") : t("moderation.alreadyReported"));
        } else if (res.status === "UNAUTHORIZED") needLogin();
        else setError(res.status === "INVALID" ? res.message : t("moderation.gone"));
      } catch {
        setError(t("moderation.reportFailed"));
      }
    });
  };
  const blockAuthor = () => {
    if (needLogin() || !window.confirm(t("moderation.blockConfirm"))) return;
    startTransition(async () => {
      try {
        const res = await blockAuthorOf({ target });
        if (res.status === "OK") {
          const message = t("moderation.blocked", { name: res.name });
          if (leaveTo) {
            carryToast(message);
            router.push(leaveTo);
          } else {
            setToast(message);
            router.refresh();
          }
        } else if (res.status === "UNAUTHORIZED") needLogin();
        else setToast(res.status === "INVALID" ? res.message : t("moderation.gone"));
      } catch {
        setToast(t("moderation.blockFailed"));
      }
    });
  };

  return (
    <span className={`${styles.actions} ${className ?? ""}`}>
      <button type="button" className={styles.link} onClick={() => !needLogin() && setOpen(true)} disabled={pending}>
        {t("moderation.report")}
      </button>
      {block && (
        <button type="button" className={styles.link} onClick={blockAuthor} disabled={pending}>
          {t("moderation.block")}
        </button>
      )}
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={t("moderation.reportTitle", { target: t(TARGET_KEY[target.type]) })}
        description={t("moderation.reportDescription")}
        width={480}
        footer={
          <>
            <Button variant="secondary" block onClick={() => setOpen(false)} disabled={pending}>
              {t("moderation.cancel")}
            </Button>
            <Button variant="primary" block onClick={report} disabled={pending || !reason}>
              {pending ? t("moderation.submitting") : t("moderation.submit")}
            </Button>
          </>
        }
      >
        <div className={styles.reasons} role="radiogroup" aria-label={t("moderation.reasonAria")}>
          {REPORT_REASONS.map((r) => (
            <label key={r.key} className={styles.reason}>
              <input type="radio" name="report-reason" checked={reason === r.key} onChange={() => setReason(r.key)} />
              {t(REASON_KEY[r.key])}
            </label>
          ))}
        </div>
        <textarea
          className={styles.detail}
          rows={3}
          maxLength={REPORT_DETAIL_MAX}
          aria-label={t("moderation.detailAria")}
          placeholder={reason === "ETC" ? t("moderation.detailRequired") : t("moderation.detailOptional")}
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
