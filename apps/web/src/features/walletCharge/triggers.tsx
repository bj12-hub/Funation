"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { ChargeModal } from "./ChargeModal";
import styles from "./charge.module.css";

/** "FN 충전" button (side nav, my page, FN 내역) that opens the charge modal. */
export function ChargeTrigger({ className, children }: { className?: string; children?: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {children === undefined ? t("walletCharge.chargeFn") : children}
      </button>
      {/* Mounted only while open so every opening starts fresh and reloads the server balance. */}
      {open && <ChargeModal onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * "모바일에서 충전 (QR코드)" — Figma 587:147.
 * TODO: the mobile charge page and the QR target URL are TBD, so the QR image is a placeholder.
 */
export function QrChargeTrigger({ className, children }: { className?: string; children?: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {children === undefined ? t("walletCharge.qrTitle") : children}
      </button>
      <Modal
        open={open}
        onClose={close}
        title={t("walletCharge.qrTitle")}
        width={520}
        className={styles.qrDialog}
        customHeader={
          <header className={styles.qrHeader}>
            <div>
              <h2>{t("walletCharge.qrTitle")}</h2>
              <p>{t("walletCharge.qrScan")}</p>
            </div>
            <button type="button" className={styles.qrClose} aria-label={t("walletCharge.close")} onClick={close}>
              ×
            </button>
          </header>
        }
      >
        <div className={styles.qrArea}>
          <div className={styles.qrPlaceholder} role="img" aria-label={t("walletCharge.qrPending")}>
            <span>QR</span>
            <small>{t("walletCharge.pending")}</small>
          </div>
        </div>
        <ol className={styles.qrSteps}>
          <li>{t("walletCharge.qrStep1")}</li>
          <li>{t("walletCharge.qrStep2")}</li>
        </ol>
        <button type="button" className={styles.qrConfirm} onClick={close}>
          {t("walletCharge.ok")}
        </button>
      </Modal>
    </>
  );
}
