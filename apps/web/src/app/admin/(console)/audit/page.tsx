import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuditLogScreen } from "@/features/admin/AdminScreens";
import { listAuditLog } from "@/services/admin/admin";
import { AUDIT_PAGE } from "@/services/admin/adminTypes";

// Code-first (no Figma frame): 감사 로그 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "감사 로그 | Somnation 관리자", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const show = Math.min(Math.max(AUDIT_PAGE, Math.floor(Number((await searchParams).show)) || AUDIT_PAGE), 500);
  const page = await listAuditLog({ show });
  if (!page) redirect("/admin/login");
  return <AuditLogScreen page={page} show={show} />;
}
