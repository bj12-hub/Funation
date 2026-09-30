import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MembersScreen } from "@/features/admin/members/MemberScreens";
import { listMembers } from "@/services/admin/members";

// Code-first (no Figma frame): 회원 관리 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "회원 관리 | Somnation 관리자", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const page = await listMembers(await searchParams);
  if (!page) redirect("/admin/login");
  return <MembersScreen page={page} />;
}
