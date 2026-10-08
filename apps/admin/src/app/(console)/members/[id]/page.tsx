import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MemberDetailScreen } from "@/features/members/MemberScreens";
import { loadMember } from "@/lib/queries";

export const metadata: Metadata = { title: "회원 상세 | Ssumnation 관리자" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const data = await loadMember((await params).id);
  if (!data) notFound();
  return <MemberDetailScreen member={data.member} audit={data.audit} />;
}
