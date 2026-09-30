"use client";

import styles from "@/features/admin.module.css";

/** Site API unreachable / refused, or an unexpected error while loading a page. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={styles.login} role="alert">
      <span className={styles.badge}>관리자</span>
      <h1 className={styles.title}>화면을 불러오지 못했어요</h1>
      <p className={styles.muted}>{error.message || "잠시 후 다시 시도해 주세요."}</p>
      <button type="button" className={styles.primary} onClick={reset}>
        다시 시도
      </button>
    </main>
  );
}
