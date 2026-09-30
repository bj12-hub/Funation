import type { Metadata } from "next";
import { redirect } from "next/navigation";
import styles from "@/features/admin/admin.module.css";
import { USE_MOCK } from "@/lib/mock";
import { getAdminSession } from "@/lib/session";
import { signInMockAdmin } from "@/services/admin/admin";

// Code-first (no Figma frame): 관리자 로그인. The real admin login (SSO / 2FA / IP allowlist) is TBD.
export const metadata: Metadata = { title: "관리자 로그인 | Somnation", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  if (await getAdminSession()) redirect("/admin");
  return (
    <div data-theme="dark" className={styles.page}>
      <main className={styles.login}>
        <span className={styles.badge}>관리자</span>
        <h1 className={styles.title}>Somnation 관리자 콘솔</h1>
        <p className={styles.muted}>운영자 인증 방식(SSO · 2단계 인증 · 접속 IP 제한)은 정해지지 않았어요 (TBD).</p>
        {USE_MOCK ? (
          <form action={signInMockAdmin} className={styles.loginForm}>
            <button type="submit" className={styles.primary}>
              개발용 운영자로 로그인 (mock)
            </button>
          </form>
        ) : (
          <p className={styles.muted}>관리자 로그인이 아직 연결되지 않았어요.</p>
        )}
        <p className={styles.muted}>로그인하면 지금 브라우저의 회원 세션은 로그아웃돼요.</p>
      </main>
    </div>
  );
}
