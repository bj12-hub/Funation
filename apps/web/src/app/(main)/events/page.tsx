import type { Metadata } from "next";
import { EventsScreen } from "@/features/events/EventsScreen";
import { getEvents } from "@/services/events/events";

// Code-first (no Figma frame): 이벤트 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "이벤트 | Funation" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  return <EventsScreen view={await getEvents((await searchParams).filter)} />;
}
