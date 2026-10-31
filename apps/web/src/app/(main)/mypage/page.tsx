import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MyPageScreen } from "@/features/mypage";
import { getT } from "@/lib/i18n/server";
import { getSession, hasRole } from "@/lib/session";
import { getMyAccount } from "@/services/account/myAccount";
import { getSupporterIdentity } from "@/services/supporter/identity";

// Figma: ssumnation-my-page 735:4119 · 622:4
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("my.meta") };
}
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
