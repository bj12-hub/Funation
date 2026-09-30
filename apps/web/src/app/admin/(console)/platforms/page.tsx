import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PlatformsScreen } from "@/features/admin/system/SystemScreens";
import { getPlatformStatus } from "@/services/admin/system";

// Code-first (no Figma frame): 플랫폼 연동 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "플랫폼 연동 | Somnation 관리자", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await getPlatformStatus();
  if (!rows) redirect("/admin/login");
  return <PlatformsScreen rows={rows} />;
}
