import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TitlesScreen } from "@/features/supporter/TitlesScreen";
import { getT } from "@/lib/i18n/server";
import { getMyAccount } from "@/services/account/myAccount";
import { getSupporterIdentity } from "@/services/supporter/identity";

// Code-first (no Figma frame): 칭호·등급 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("myTitles.meta") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [account, identity] = await Promise.all([getMyAccount(), getSupporterIdentity()]);
  if (!account || !identity) redirect("/login?next=/mypage/titles");
  return (
    <>
      <TitlesScreen identity={identity} />
    </>
  );
}
