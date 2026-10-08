"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { ChargeModal } from "./ChargeModal";
import styles from "./charge.module.css";

/** "FN 충전" button (side nav, my page, FN 내역) that opens the charge modal. */
export function ChargeTrigger({ className, children = "FN 충전" }: { className?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {children}
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
export function QrChargeTrigger({ className, children = "모바일에서 충전 (QR코드)" }: { className?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {children}
      </button>
      <Modal
        open={open}
        onClose={close}
        title="모바일에서 충전 (QR코드)"
        width={520}
        className={styles.qrDialog}
        customHeader={
          <header className={styles.qrHeader}>
            <div>
              <h2>모바일에서 충전 (QR코드)</h2>
              <p>휴대폰 기본 카메라앱으로 QR코드를 스캔해주세요</p>
            </div>
            <button type="button" className={styles.qrClose} aria-label="닫기" onClick={close}>
              ×
            </button>
          </header>
        }
      >
        <div className={styles.qrArea}>
          <div className={styles.qrPlaceholder} role="img" aria-label="QR 코드 준비 중">
            <span>QR</span>
            <small>준비 중</small>
          </div>
        </div>
        <ol className={styles.qrSteps}>
          <li>1. QR코드 스캔 시, 모바일용 충전페이지로 이동합니다.</li>
          <li>2. 모바일에서 로그인 후 결제를 진행해주세요.</li>
        </ol>
        <button type="button" className={styles.qrConfirm} onClick={close}>
          확인
        </button>
      </Modal>
    </>
  );
}
