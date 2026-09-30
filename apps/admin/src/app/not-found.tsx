import Link from "next/link";
import styles from "@/features/admin.module.css";

export default function NotFound() {
  return (
    <main className={styles.login}>
      <span className={styles.badge}>관리자</span>
      <h1 className={styles.title}>찾을 수 없는 화면이에요</h1>
      <Link href="/" className={styles.link}>
        대시보드로 가기
      </Link>
    </main>
  );
}
