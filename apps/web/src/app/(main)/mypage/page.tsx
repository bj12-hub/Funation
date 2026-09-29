import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MyPageScreen } from "@/features/mypage";
import { getSession, hasRole } from "@/lib/session";
import { getMyAccount } from "@/services/account/myAccount";
import { getSupporterIdentity } from "@/services/supporter/identity";

// Figma: funation-my-page 735:4119 · 622:4
export const metadata: Metadata = { title: "내 정보 | Somnation" };
export const dynamic = "force-dynamic";

export default async function Page() {
  // Route guard for UX only; the backend must authorize every account read and update.
  const [account, identity, session] = await Promise.all([getMyAccount(), getSupporterIdentity(), getSession()]);
  if (!account) redirect("/login?next=/mypage");

  return (
    <>
      <MyPageScreen account={account} grade={identity?.grade ?? null} creator={hasRole(session, "CREATOR")} />
    </>
  );
}
