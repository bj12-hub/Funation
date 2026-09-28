import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SideNavLayout } from "@/components/layout/SideNav";
import { AttendanceScreen } from "@/features/attendance";
import { getMyAccount } from "@/services/account/myAccount";
import { getAttendance } from "@/services/attendance/attendance";

// Figma: funation-attendance-page 583:4 · 585:452 · 585:66 · 585:830
export const metadata: Metadata = { title: "출석체크 | Funation" };
export const dynamic = "force-dynamic";

export default async function Page() {
  // Route guard for UX only; the backend must authorize check-in and reward claims.
  const [account, summary] = await Promise.all([getMyAccount(), getAttendance()]);
  if (!account || !summary) redirect("/login?next=/attendance");

  return (
    <SideNavLayout
      user={{ nickname: account.nickname, funationId: account.funationId, avatarUrl: account.avatarUrl, fnBalance: account.fnBalance }}
      showWatchHistory
    >
      <AttendanceScreen summary={summary} />
    </SideNavLayout>
  );
}
