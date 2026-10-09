import type { Metadata } from "next";
import { EventsAdminScreen } from "@/features/events/EventsAdminScreen";
import { loadEvents } from "@/lib/queries";

export const metadata: Metadata = { title: "이벤트 | Ssumnation 관리자" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await loadEvents();
  if (!view) throw new Error("이벤트를 불러오지 못했어요.");
  return <EventsAdminScreen view={view} />;
}
