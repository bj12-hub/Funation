"use client";

import { Button } from "@/components/ui/Button";
import styles from "./error.module.css";

/** ERROR state for the home feed. */
export default function HomeError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className={styles.root} role="alert">
      <h1 className={styles.title}>홈 화면을 불러오지 못했습니다</h1>
      <p className={styles.description}>일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요</p>
      <Button onClick={reset}>다시 시도</Button>
    </section>
  );
}
