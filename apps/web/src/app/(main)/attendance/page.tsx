import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AttendanceScreen } from "@/features/attendance";
import { getMyAccount } from "@/services/account/myAccount";
import { getAttendance } from "@/services/attendance/attendance";

// Figma: ssumnation-attendance-page 583:4 · 585:452 · 585:66 · 585:830
export const metadata: Metadata = { title: "출석체크 | Ssumnation" };
export const dynamic = "force-dynamic";

export default async function Page() {
  // Route guard for UX only; the backend must authorize check-in and reward claims.
  const [account, summary] = await Promise.all([getMyAccount(), getAttendance()]);
  if (!account || !summary) redirect("/login?next=/attendance");

  return (
    <>
      <AttendanceScreen summary={summary} />
    </>
  );
}
