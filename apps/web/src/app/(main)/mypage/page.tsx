import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SideNavLayout } from "@/components/layout/SideNav";
import { MyPageScreen } from "@/features/mypage";
import { getMyAccount } from "@/services/account/myAccount";

// Figma: funation-my-page 735:4119 · 622:4
export const metadata: Metadata = { title: "마이페이지 | Somnation" };
export const dynamic = "force-dynamic";

export default async function Page() {
  // Route guard for UX only; the backend must authorize every account read and update.
  const account = await getMyAccount();
  if (!account) redirect("/login?next=/mypage");

  return (
    <SideNavLayout
      user={{ nickname: account.nickname, funationId: account.funationId, avatarUrl: account.avatarUrl, fnBalance: account.fnBalance }}
      showWatchHistory
    >
      <MyPageScreen account={account} />
    </SideNavLayout>
  );
}
