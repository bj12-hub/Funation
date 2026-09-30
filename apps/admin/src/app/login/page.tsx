import type { Metadata } from "next";
import { redirect } from "next/navigation";
import styles from "@/features/admin.module.css";
import { signInMockOperator } from "@/lib/actions";
import { getOperator, isMock } from "@/lib/session";

// Operator sign-in. The real admin login (SSO / 2FA / IP allowlist) is TBD.
export const metadata: Metadata = { title: "로그인 | Somnation 관리자" };
export const dynamic = "force-dynamic";

export default async function Page() {
  if (await getOperator()) redirect("/");
  return (
    <main className={styles.login}>
      <span className={styles.badge}>관리자</span>
      <h1 className={styles.title}>Somnation 관리자 콘솔</h1>
      <p className={styles.muted}>사이트와 분리된 운영 전용 앱이에요. 운영자 인증 방식(SSO · 2단계 인증 · 접속 IP 제한)은 정해지지 않았어요 (TBD).</p>
      {isMock() ? (
        <form action={signInMockOperator} className={styles.loginForm}>
          <button type="submit" className={styles.primary}>
            개발용 운영자로 로그인 (mock)
          </button>
        </form>
      ) : (
        <p className={styles.muted}>운영자 로그인이 아직 연결되지 않았어요.</p>
      )}
    </main>
  );
}
