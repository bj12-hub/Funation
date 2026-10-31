"use client";

import { Modal } from "@/components/ui/Modal";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "./donationDialogs.module.css";

/** What the donation alert will show — resolved on the server (getAlertBadges), never assembled in the browser. */
export type AlertPreview = { status: "LOADING" } | { status: "READY"; name: string; badges: string[] } | { status: "ERROR" };

/** Figma 613:6 후원하기 확인 (+ 후원 알림 미리보기, code-first) */
export function DonationConfirmDialog({
  open,
  creatorName,
  amount,
  rows,
  alert,
  pending,
  error,
  onCancel,
  onConfirm
}: {
  open: boolean;
  creatorName: string;
  amount: number;
  /** Type-specific rows (message, signature, video …). */
  rows: { label: string; value: string }[];
  /** null = signed-out or no preview. */
  alert: AlertPreview | null;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  return (
    <Modal open={open} onClose={pending ? () => {} : onCancel} title={t("roomDonate.confirmTitle")} width={460}>
      <p className={styles.lead}>{t("roomDonate.confirmLead")}</p>
      <dl className={styles.info}>
        <div className={styles.infoRow}>
          <dt>{t("roomDonate.recipient")}</dt>
          <dd className={styles.strong}>{creatorName}</dd>
        </div>
        <div className={styles.infoRow}>
          <dt>{t("roomDonate.amount")}</dt>
          <dd className={styles.amount}>{formatNumber(amount)} FN</dd>
        </div>
        {rows.map((row) => (
          <div key={row.label} className={styles.infoMessage}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {alert && (
        <section className={styles.alertPreview} aria-labelledby="donation-alert-preview" aria-busy={alert.status === "LOADING"}>
          <h3 id="donation-alert-preview" className={styles.alertPreviewTitle}>
            {t("roomDonate.alertPreview")}
          </h3>
          {alert.status === "LOADING" && <p className={styles.alertPreviewNote}>{t("roomDonate.loading")}</p>}
          {alert.status === "ERROR" && <p className={styles.alertPreviewNote}>{t("roomDonate.alertError")}</p>}
          {alert.status === "READY" && (
            <>
              {alert.badges.length > 0 && (
                <span className={styles.alertBadges}>
                  {alert.badges.map((b) => (
                    <span key={b} className={styles.alertBadge}>
                      {b}
                    </span>
                  ))}
                </span>
              )}
              <p className={styles.alertHeadline}>
                <strong>{alert.name}</strong>
                {t("roomDonate.alertBy")}
                <strong className={styles.alertAmount}>{formatNumber(amount)} FN</strong>
                {t("roomDonate.alertEnd")}
              </p>
            </>
          )}
        </section>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onCancel} disabled={pending}>
          {t("roomDonate.cancel")}
        </button>
        <button type="button" className={styles.pink} onClick={onConfirm} disabled={pending}>
          {pending ? t("roomDonate.donating") : t("roomDonate.donate")}
        </button>
      </div>
    </Modal>
  );
}

/** Figma 613:122 후원 완료. Both numbers come from the server result. */
export function DonationCompleteDialog({ open, fnAmount, balance, onClose }: { open: boolean; fnAmount: number; balance: number; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Modal open={open} onClose={onClose} title={t("roomDonate.completeTitle")} width={460}>
      <div className={styles.center}>
        <span className={`${styles.badge} ${styles.badgePink}`} aria-hidden="true">
          💖
        </span>
        <strong className={styles.headline}>{t("roomDonate.completeHeadline")}</strong>
        <p className={styles.sub}>{t("roomDonate.completeSub")}</p>
      </div>
      <dl className={styles.info}>
        <div className={styles.infoRow}>
          <dt>{t("roomDonate.debited")}</dt>
          <dd className={styles.strong}>-{formatNumber(fnAmount)} FN</dd>
        </div>
        <div className={styles.infoRow}>
          <dt>{t("roomDonate.remaining")}</dt>
          <dd className={styles.remaining}>{formatNumber(balance)} FN</dd>
        </div>
      </dl>
      <button type="button" className={styles.purple} onClick={onClose}>
        {t("roomDonate.ok")}
      </button>
    </Modal>
  );
}

/** Figma 613:237 FN 부족 안내. The balance comes from the server. */
export function InsufficientFnDialog({
  open,
  balance,
  onCancel,
  onCharge
}: {
  open: boolean;
  balance: number;
  onCancel: () => void;
  onCharge: () => void;
}) {
  const { t } = useI18n();
  return (
    <Modal open={open} onClose={onCancel} title={t("roomDonate.insufficientTitle")} width={460}>
      <div className={styles.center}>
        <span className={`${styles.badge} ${styles.badgeGold}`} aria-hidden="true">
          ⚠️
        </span>
        <strong className={styles.headline}>{t("roomDonate.insufficientHeadline")}</strong>
        <p className={styles.body}>
          {t("roomDonate.currentBalance", { amount: formatNumber(balance) })}
          <br />
          {t("roomDonate.chargePrompt")}
        </p>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          {t("roomDonate.cancel")}
        </button>
        <button type="button" className={styles.pink} onClick={onCharge}>
          {t("roomDonate.charge")}
        </button>
      </div>
    </Modal>
  );
}
