import { SideNavLayout } from "@/components/layout/SideNav";
import { getMyAccount } from "@/services/account/myAccount";

// Figma 617:316 / 617:5 — 260px side navigation + content.
export default async function LiveLayout({ children }: { children: React.ReactNode }) {
  const account = await getMyAccount();
  const user = account && {
    nickname: account.nickname,
    funationId: account.funationId,
    avatarUrl: account.avatarUrl,
    fnBalance: account.fnBalance
  };
  return <SideNavLayout user={user}>{children}</SideNavLayout>;
}
