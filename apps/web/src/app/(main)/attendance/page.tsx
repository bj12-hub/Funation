import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AttendanceScreen } from "@/features/attendance";
import { getT } from "@/lib/i18n/server";
import { getMyAccount } from "@/services/account/myAccount";
import { getAttendance } from "@/services/attendance/attendance";

// Figma: ssumnation-attendance-page 583:4 · 585:452 · 585:66 · 585:830
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("myAttendance.meta") };
}
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
