import Link from "next/link";
import styles from "@/features/admin.module.css";

export default function NotFound() {
  return (
    <main className={styles.login}>
      <section className={styles.loginCard}>
        <span className={styles.chipNeutral}>404</span>
        <h1 className={styles.title}>찾을 수 없는 화면이에요</h1>
        <Link href="/" className={styles.link}>
          대시보드로 가기
        </Link>
      </section>
    </main>
  );
}
