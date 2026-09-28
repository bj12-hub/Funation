"use client";

import { useEffect } from "react";
import styles from "./Toast.module.css";

type ToastProps = {
  message: string | null;
  onDone: () => void;
  /** `accent`: pink-bordered (favorites 826:510). `neutral`: dark pill with a green mark (share 833:1072). */
  tone?: "accent" | "neutral";
  durationMs?: number;
};

/** Short confirmation message. Announced to screen readers via role="status". */
export function Toast({ message, onDone, tone = "accent", durationMs = 2200 }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDone, durationMs);
    return () => clearTimeout(timer);
  }, [message, onDone, durationMs]);

  return (
    <div className={styles.region} role="status" aria-live="polite">
      {message && (
        <div className={`${styles.toast} ${styles[tone]}`}>
          <span className={styles.mark} aria-hidden="true">
            {tone === "accent" ? "✓" : ""}
          </span>
          {message}
        </div>
      )}
    </div>
  );
}
