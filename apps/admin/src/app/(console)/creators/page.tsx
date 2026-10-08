import type { Metadata } from "next";
import { CreatorsAdminScreen } from "@/features/members/MemberScreens";
import { loadCreators } from "@/lib/queries";

export const metadata: Metadata = { title: "크리에이터 관리 | Ssumnation 관리자" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const rows = await loadCreators(q);
  if (!rows) throw new Error("크리에이터 목록을 불러오지 못했어요.");
  return <CreatorsAdminScreen rows={rows} q={q} />;
}
