import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FlextvMyPageScreen, MyPageScreen } from "@/features/mypage";
import { FLEXTV_SITE } from "@/lib/flextv/mode";
import { getSession, hasRole } from "@/lib/session";
import { getFlextvMyAccount } from "@/services/account/flextvAccount";
import { getMyAccount } from "@/services/account/myAccount";
import { getSupporterIdentity } from "@/services/supporter/identity";

// Figma: ssumnation-my-page 735:4119 · 622:4
export const metadata: Metadata = { title: "내 정보 | Ssumnation" };
export const dynamic = "force-dynamic";

export default async function Page() {
  // Route guard for UX only; the backend must authorize every account read and update.
  if (FLEXTV_SITE) {
    const [account, session] = await Promise.all([getFlextvMyAccount(), getSession()]);
    if (!account) redirect("/login?next=/mypage");
    return <FlextvMyPageScreen account={account} creator={hasRole(session, "CREATOR")} />;
  }
  const [account, identity, session] = await Promise.all([getMyAccount(), getSupporterIdentity(), getSession()]);
  if (!account) redirect("/login?next=/mypage");

  return (
    <>
      <MyPageScreen account={account} grade={identity?.grade ?? null} creator={hasRole(session, "CREATOR")} />
    </>
  );
}
