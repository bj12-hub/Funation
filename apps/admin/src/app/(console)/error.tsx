"use client";

import styles from "@/features/admin.module.css";

/**
 * ERROR state inside the console: the menu stays, so the operator can retry or go to another page
 * (e.g. the site API is unreachable for one screen). The root error page still covers the login screen.
 */
export default function ConsoleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className={styles.content}>
      <section className={styles.card} role="alert">
        <div>
          <span className={styles.chipBad}>오류</span>
        </div>
        <h1 className={styles.title}>화면을 불러오지 못했어요</h1>
        <p className={styles.muted}>{error.message || "잠시 후 다시 시도해 주세요."}</p>
        <div>
          <button type="button" className={styles.primary} onClick={reset}>
            다시 시도
          </button>
        </div>
      </section>
    </div>
  );
}
