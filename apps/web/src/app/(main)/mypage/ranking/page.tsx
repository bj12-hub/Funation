import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SideNavLayout } from "@/components/layout/SideNav";
import { MyRankingScreen } from "@/features/supporter/MyRankingScreen";
import { getMyAccount } from "@/services/account/myAccount";
import { getMyRanking } from "@/services/supporter/ranking";

// Code-first (no Figma frame): 내 후원 랭킹 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "내 랭킹 | Somnation" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const [account, view] = await Promise.all([getMyAccount(), getMyRanking((await searchParams).period)]);
  if (!account || !view) redirect("/login?next=/mypage/ranking");
  return (
    <SideNavLayout user={{ nickname: account.nickname, funationId: account.funationId, avatarUrl: account.avatarUrl, fnBalance: account.fnBalance }} showWatchHistory>
      <MyRankingScreen view={view} />
    </SideNavLayout>
  );
}
