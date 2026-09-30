import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboardScreen } from "@/features/admin/AdminScreens";
import { getAdminDashboard } from "@/services/admin/admin";

// Code-first (no Figma frame): 운영 대시보드 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "대시보드 | Somnation 관리자", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await getAdminDashboard();
  if (!data) redirect("/admin/login");
  return <AdminDashboardScreen data={data} />;
}
