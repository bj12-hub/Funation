import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreatorsAdminScreen } from "@/features/admin/members/MemberScreens";
import { listAdminCreators } from "@/services/admin/members";

// Code-first (no Figma frame): 크리에이터 관리 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "크리에이터 관리 | Somnation 관리자", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const rows = await listAdminCreators({ q });
  if (!rows) redirect("/admin/login");
  return <CreatorsAdminScreen rows={rows} q={q} />;
}
