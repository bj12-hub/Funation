"use client";

import { Button } from "@/components/ui/Button";
import styles from "./PageError.module.css";

/** ERROR state body for route `error.tsx` boundaries. */
export function PageError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <section className={styles.root} role="alert">
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요</p>
      <Button onClick={onRetry}>다시 시도</Button>
    </section>
  );
}
