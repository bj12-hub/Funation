"use client";

import type { ReactNode } from "react";
import { AlertTriangleIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import styles from "./settlement.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  lines: string[];
  /** Primary action (link or button) shown next to 취소. */
  action: ReactNode;
  width?: number;
};

/** Centered alert modal of 433:4 · 462:2 · 480:2 — warning icon, title, copy, 취소 + primary action. */
export function SettlementNoticeModal({ open, onClose, title, lines, action, width = 500 }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={width}
      customHeader={
        <div className={styles.notice}>
          <span className={styles.noticeIcon} aria-hidden="true">
            <AlertTriangleIcon />
          </span>
          <h2 className={styles.noticeTitle}>{title}</h2>
          <p className={styles.noticeText}>
            {lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </p>
        </div>
      }
      footer={
        <>
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            취소
          </button>
          {action}
        </>
      }
    />
  );
}
