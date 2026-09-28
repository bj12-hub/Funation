"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./Modal.module.css";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Action row (Figma: two equal buttons). */
  footer?: ReactNode;
  /**
   * Replaces the default title block (e.g. the 본인인증 result header 750:*). `title` is still
   * used as the dialog's accessible name. Receives the close handler for its own × button.
   */
  customHeader?: ReactNode;
  /** Panel width in px (default 520). */
  width?: number;
  /** Extra class on the <dialog>, e.g. a light theme (결제수단변경 601:839). */
  className?: string;
};

/**
 * Modal dialog. Figma shell: my page edit modals (743:1978 …) — 520px, radius 16, dimmed backdrop.
 * Uses the native <dialog> for focus trapping, Esc to close and inert background.
 */
export function Modal({ open, onClose, title, description, children, footer, customHeader, width, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={className ? `${styles.dialog} ${className}` : styles.dialog}
      style={width ? { width: `min(${width}px, calc(100vw - 32px))` } : undefined}
      aria-labelledby={customHeader ? undefined : titleId}
      aria-label={customHeader ? title : undefined}
      aria-describedby={description && !customHeader ? descriptionId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Clicking the backdrop (the dialog element itself) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <div className={styles.panel}>
          {customHeader ?? (
            <header className={styles.header}>
              <div className={styles.titleRow}>
                <h2 id={titleId} className={styles.title}>
                  {title}
                </h2>
                <button type="button" className={styles.close} aria-label="닫기" onClick={onClose}>
                  ×
                </button>
              </div>
              {description && (
                <p id={descriptionId} className={styles.description}>
                  {description}
                </p>
              )}
            </header>
          )}
          {children}
          {footer && <div className={styles.footer}>{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
