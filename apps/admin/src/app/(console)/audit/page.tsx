import type { Metadata } from "next";
import { AuditLogScreen } from "@/features/AdminScreens";
import { loadAudit } from "@/lib/queries";
import { AUDIT_MAX, AUDIT_PAGE } from "@/types/adminApi";

export const metadata: Metadata = { title: "감사 로그 | Somnation 관리자" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const show = Math.min(Math.max(AUDIT_PAGE, Math.floor(Number((await searchParams).show)) || AUDIT_PAGE), AUDIT_MAX);
  const page = await loadAudit(show);
  if (!page) throw new Error("감사 로그를 불러오지 못했어요.");
  return <AuditLogScreen page={page} show={show} />;
}
