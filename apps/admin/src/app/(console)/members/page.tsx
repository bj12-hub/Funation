import type { Metadata } from "next";
import { MembersScreen } from "@/features/members/MemberScreens";
import { loadMembers } from "@/lib/queries";

export const metadata: Metadata = { title: "회원 관리 | Ssumnation 관리자" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const one = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : undefined);
  const page = await loadMembers({ q: one("q"), role: one("role"), status: one("status"), page: one("page") });
  if (!page) throw new Error("회원 목록을 불러오지 못했어요.");
  return <MembersScreen page={page} />;
}
