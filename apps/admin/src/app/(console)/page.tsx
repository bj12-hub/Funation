import type { Metadata } from "next";
import { AdminDashboardScreen } from "@/features/AdminScreens";
import { loadDashboard } from "@/lib/queries";

export const metadata: Metadata = { title: "대시보드 | Somnation 관리자" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await loadDashboard();
  if (!data) throw new Error("대시보드를 불러오지 못했어요.");
  return <AdminDashboardScreen data={data} />;
}
