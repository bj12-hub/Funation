import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminHeader, AdminSideNav } from "@/features/admin/AdminChrome";
import studio from "@/features/creatorStudio/studio.module.css";
import { getSession, hasRole } from "@/lib/session";

// Code-first (no Figma frame): 관리자 콘솔 shell. Admin role only.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // UX guard only; every admin service re-checks the role (getAdminSession) and the backend must too.
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!hasRole(session, "ADMIN")) {
    return (
      <div data-theme="dark" className={studio.themeScope}>
        <main className={studio.noAccess}>
          <h1 className={studio.noAccessTitle}>관리자 권한이 필요합니다</h1>
          <p className={studio.noAccessText}>관리자 콘솔은 운영자 계정으로만 이용할 수 있어요.</p>
          <Link href="/admin/login" className={studio.noAccessButton}>
            관리자 로그인
          </Link>
          <Link href="/" className={studio.noAccessLink}>
            홈으로 가기
          </Link>
        </main>
      </div>
    );
  }
  return (
    <div data-theme="dark" className={studio.themeScope}>
      <AdminHeader operator={session.nickname} />
      <div className={studio.shell}>
        <AdminSideNav />
        <main className={studio.main}>{children}</main>
      </div>
    </div>
  );
}
