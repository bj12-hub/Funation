import Link from "next/link";
import styles from "./helper.module.css";

/** 404 on the helper domain — code-first (no Figma frame). The site's own pages are not served there. */
export function HelperNotFound() {
  return (
    <main className={styles.landing}>
      <div>
        <h1 className={styles.landingTitle}>도우미에 없는 페이지예요</h1>
        <p className={styles.landingText}>주소를 다시 확인해 주세요. 지갑 · 후원 · 정산 같은 썸네이션 사이트 기능은 도우미 주소에서 열리지 않아요.</p>
      </div>
      <div className={styles.landingActions}>
        <Link href="/" className={styles.primary}>
          도우미 홈
        </Link>
      </div>
    </main>
  );
}
