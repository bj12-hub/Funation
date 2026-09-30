import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SystemScreen } from "@/features/admin/system/SystemScreens";
import { getSystemView } from "@/services/admin/system";

// Code-first (no Figma frame): 시스템 (사이트 공지 배너) — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "시스템 | Somnation 관리자", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getSystemView();
  if (!view) redirect("/admin/login");
  return <SystemScreen view={view} />;
}
