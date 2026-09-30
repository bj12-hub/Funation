import type { Metadata } from "next";
import { PlatformsScreen } from "@/features/system/SystemScreens";
import { loadPlatforms } from "@/lib/queries";

export const metadata: Metadata = { title: "플랫폼 연동 | Somnation 관리자" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await loadPlatforms();
  if (!rows) throw new Error("플랫폼 상태를 불러오지 못했어요.");
  return <PlatformsScreen rows={rows} />;
}
