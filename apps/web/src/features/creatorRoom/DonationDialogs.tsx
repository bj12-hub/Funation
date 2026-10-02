"use client";

import { Modal } from "@/components/ui/Modal";
import { formatNumber } from "@/lib/format";
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
  return (
    <Modal open={open} onClose={pending ? () => {} : onCancel} title="후원하기 확인" width={460}>
      <p className={styles.lead}>선택하신 정보로 후원을 진행하시겠습니까? 내용을 다시 한번 확인해주세요.</p>
      <dl className={styles.info}>
        <div className={styles.infoRow}>
          <dt>후원 대상</dt>
          <dd className={styles.strong}>{creatorName}</dd>
        </div>
        <div className={styles.infoRow}>
          <dt>후원 금액</dt>
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
            후원 알림 미리보기
          </h3>
          {alert.status === "LOADING" && <p className={styles.alertPreviewNote}>불러오는 중…</p>}
          {alert.status === "ERROR" && <p className={styles.alertPreviewNote}>미리보기를 불러오지 못했어요. 후원은 그대로 진행할 수 있어요.</p>}
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
                <strong>{alert.name}</strong>님이 <strong className={styles.alertAmount}>{formatNumber(amount)} FN</strong> 후원!
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
          취소
        </button>
        <button type="button" className={styles.pink} onClick={onConfirm} disabled={pending}>
          {pending ? "후원 진행 중..." : "후원하기"}
        </button>
      </div>
    </Modal>
  );
}

/** Figma 613:122 후원 완료. Both numbers come from the server result. */
export function DonationCompleteDialog({ open, fnAmount, balance, onClose }: { open: boolean; fnAmount: number; balance: number; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="후원 완료" width={460}>
      <div className={styles.center}>
        <span className={`${styles.badge} ${styles.badgePink}`} aria-hidden="true">
          💖
        </span>
        <strong className={styles.headline}>후원이 정상적으로 완료되었습니다!</strong>
        <p className={styles.sub}>스트리머에게 소중한 마음이 안전하게 전달되었습니다.</p>
      </div>
      <dl className={styles.info}>
        <div className={styles.infoRow}>
          <dt>차감 FN</dt>
          <dd className={styles.strong}>-{formatNumber(fnAmount)} FN</dd>
        </div>
        <div className={styles.infoRow}>
          <dt>잔여 FN</dt>
          <dd className={styles.remaining}>{formatNumber(balance)} FN</dd>
        </div>
      </dl>
      <button type="button" className={styles.purple} onClick={onClose}>
        확인
      </button>
    </Modal>
  );
}

/**
 * Figma 613:237 FN 부족 안내. With `required` it uses the LuckyBox variant 875:8546
 * (현재 보유 / 필요 금액 / 부족 금액). The numbers come from the server or its catalog.
 */
export function InsufficientFnDialog({
  open,
  balance,
  required,
  onCancel,
  onCharge
}: {
  open: boolean;
  balance: number;
  required?: number;
  onCancel: () => void;
  onCharge: () => void;
}) {
  if (required !== undefined) {
    return (
      <Modal open={open} onClose={onCancel} title="FN 잔액이 부족해요" width={460}>
        <div className={styles.center}>
          <span className={styles.bigEmoji} aria-hidden="true">
            💳
          </span>
          <strong className={styles.headline}>FN 잔액이 부족해요</strong>
        </div>
        <dl className={styles.shortage}>
          <div>
            <dt>현재 보유</dt>
            <dd>{formatNumber(balance)} FN</dd>
          </div>
          <div>
            <dt>필요 금액</dt>
            <dd>{formatNumber(required)} FN</dd>
          </div>
          <div>
            <dt>부족 금액</dt>
            <dd className={styles.short}>{formatNumber(Math.max(0, required - balance))} FN</dd>
          </div>
        </dl>
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel}>
            취소
          </button>
          <button type="button" className={styles.pink} onClick={onCharge}>
            FN 충전하기
          </button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal open={open} onClose={onCancel} title="FN 부족 안내" width={460}>
      <div className={styles.center}>
        <span className={`${styles.badge} ${styles.badgeGold}`} aria-hidden="true">
          ⚠️
        </span>
        <strong className={styles.headline}>보유한 FN이 부족합니다</strong>
        <p className={styles.body}>
          현재 보유 FN: {formatNumber(balance)} FN
          <br />
          FN을 충전하러 이동하시겠습니까?
        </p>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          취소
        </button>
        <button type="button" className={styles.pink} onClick={onCharge}>
          FN 충전
        </button>
      </div>
    </Modal>
  );
}
