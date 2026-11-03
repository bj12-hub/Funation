import type { Metadata } from "next";
import { EventsScreen } from "@/features/events/EventsScreen";
import { FlextvEventsScreen } from "@/features/events/FlextvEventScreens";
import { FLEXTV_SITE } from "@/lib/flextv/mode";
import { getT } from "@/lib/i18n/server";
import { getEvents } from "@/services/events/events";
import { getFlextvEvents } from "@/services/events/flextvEvents";

// Code-first (no Figma frame): 이벤트 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("events.meta") };
}
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ filter?: string; show?: string }> }) {
  const { filter, show } = await searchParams;
  // With FLEXTV (phase 9): FLEXTV's events.
  if (FLEXTV_SITE) return <FlextvEventsScreen view={await getFlextvEvents(filter, show)} />;
  return <EventsScreen view={await getEvents(filter)} />;
}
