import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MemberDetailScreen } from "@/features/admin/members/MemberScreens";
import { getMemberDetail } from "@/services/admin/members";

// Code-first (no Figma frame): 회원 상세 · 이용 제한
export const metadata: Metadata = { title: "회원 상세 | Somnation 관리자", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const data = await getMemberDetail((await params).id);
  if (!data) notFound();
  return <MemberDetailScreen member={data.member} audit={data.audit} />;
}
