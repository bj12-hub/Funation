import type { Metadata } from "next";
import { SystemScreen } from "@/features/system/SystemScreens";
import { loadSystem } from "@/lib/queries";

export const metadata: Metadata = { title: "시스템 | Ssumnation 관리자" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await loadSystem();
  if (!view) throw new Error("시스템 정보를 불러오지 못했어요.");
  return <SystemScreen view={view} />;
}
