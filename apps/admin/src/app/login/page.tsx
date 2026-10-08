import type { Metadata } from "next";
import { redirect } from "next/navigation";
import styles from "@/features/admin.module.css";
import { signInMockOperator } from "@/lib/actions";
import { getOperator, isMock } from "@/lib/session";

// Operator sign-in — Figma "Somnation Admin" A-00 로그인. The real admin login (SSO / 2FA / IP allowlist) is TBD.
export const metadata: Metadata = { title: "로그인 | Ssumnation 관리자" };
export const dynamic = "force-dynamic";

export default async function Page() {
  if (await getOperator()) redirect("/");
  return (
    <main className={styles.login}>
      <section className={styles.loginCard}>
        <span className={styles.loginBrand}>
          <span className={styles.loginMark} aria-hidden="true">
            S
          </span>
          Ssumnation Admin
        </span>
        <h1 className={styles.title}>관리자 콘솔 로그인</h1>
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
        <p className={styles.loginNote}>admin 서브도메인 전용 · 사이트 계정과 세션을 공유하지 않아요</p>
      </section>
    </main>
  );
}
