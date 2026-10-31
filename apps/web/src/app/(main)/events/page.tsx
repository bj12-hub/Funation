import type { Metadata } from "next";
import { EventsScreen } from "@/features/events/EventsScreen";
import { getT } from "@/lib/i18n/server";
import { getEvents } from "@/services/events/events";

// Code-first (no Figma frame): 이벤트 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("events.meta") };
}
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  return <EventsScreen view={await getEvents((await searchParams).filter)} />;
}
