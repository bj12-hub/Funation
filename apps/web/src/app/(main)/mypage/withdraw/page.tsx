import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WithdrawScreen } from "@/features/mypage/WithdrawScreen";
import { getT } from "@/lib/i18n/server";
import { getWithdrawalInfo } from "@/services/account/withdrawal";

// Code-first (no Figma frame): 회원 탈퇴 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("myWithdraw.meta") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  // Route guard for UX only; withdrawAccount re-checks the session and every condition on the server.
  const info = await getWithdrawalInfo();
  if (!info) redirect("/login?next=/mypage/withdraw");
  return <WithdrawScreen info={info} />;
}
