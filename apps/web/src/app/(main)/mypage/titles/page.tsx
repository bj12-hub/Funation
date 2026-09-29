import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SideNavLayout } from "@/components/layout/SideNav";
import { TitlesScreen } from "@/features/supporter/TitlesScreen";
import { getMyAccount } from "@/services/account/myAccount";
import { getSupporterIdentity } from "@/services/supporter/identity";

// Code-first (no Figma frame): 칭호·등급 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "칭호·등급 | Funation" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [account, identity] = await Promise.all([getMyAccount(), getSupporterIdentity()]);
  if (!account || !identity) redirect("/login?next=/mypage/titles");
  return (
    <SideNavLayout user={{ nickname: account.nickname, funationId: account.funationId, avatarUrl: account.avatarUrl, fnBalance: account.fnBalance }} showWatchHistory>
      <TitlesScreen identity={identity} />
    </SideNavLayout>
  );
}
