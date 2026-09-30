import Link from "next/link";
import styles from "./NotFoundView.module.css";

/**
 * 공통 404 — code-first (no Figma frame). Used inside the site shell (`(main)/not-found.tsx`) and on its
 * own for unmatched URLs (`app/not-found.tsx`). Deleted, hidden (신고 처리) and suspended content land
 * here too, so the copy does not say why the page is missing.
 */
export function NotFoundView({ standalone = false }: { standalone?: boolean }) {
  return (
    <section className={`${styles.root} ${standalone ? styles.standalone : ""}`} aria-labelledby="not-found-title">
      {standalone && (
        <Link href="/" className={styles.logo} aria-label="Somnation 홈">
          Somnation
        </Link>
      )}
      <p className={styles.code} aria-hidden="true">
        404
      </p>
      <h1 id="not-found-title" className={styles.title}>
        페이지를 찾을 수 없어요
      </h1>
      <p className={styles.description}>주소가 바뀌었거나, 삭제 · 비공개 처리된 페이지예요. 주소를 다시 확인해 주세요.</p>
      <div className={styles.actions}>
        <Link href="/" className={styles.primary}>
          홈으로 가기
        </Link>
        <Link href="/creators" className={styles.secondary}>
          크리에이터 찾기
        </Link>
        <Link href="/support" className={styles.secondary}>
          고객센터
        </Link>
      </div>
    </section>
  );
}
