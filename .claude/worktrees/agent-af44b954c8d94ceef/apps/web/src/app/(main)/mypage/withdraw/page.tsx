import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WithdrawScreen } from "@/features/mypage/WithdrawScreen";
import { getWithdrawalInfo } from "@/services/account/withdrawal";

// Code-first (no Figma frame): 회원 탈퇴 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "회원 탈퇴 | Somnation" };
export const dynamic = "force-dynamic";

export default async function Page() {
  // Route guard for UX only; withdrawAccount re-checks the session and every condition on the server.
  const info = await getWithdrawalInfo();
  if (!info) redirect("/login?next=/mypage/withdraw");
  return <WithdrawScreen info={info} />;
}
