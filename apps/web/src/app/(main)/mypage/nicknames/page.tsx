import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NicknamesScreen } from "@/features/supporter/NicknamesScreen";
import { getT } from "@/lib/i18n/server";
import { getMyAccount } from "@/services/account/myAccount";
import { getSupporterIdentity } from "@/services/supporter/identity";

// Code-first (no Figma frame): 별명 관리 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("myNicknames.meta") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [account, identity] = await Promise.all([getMyAccount(), getSupporterIdentity()]);
  if (!account || !identity) redirect("/login?next=/mypage/nicknames");
  return (
    <>
      <NicknamesScreen nicknames={identity.nicknames} />
    </>
  );
}
