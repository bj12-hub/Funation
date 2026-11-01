import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { EventDetailScreen } from "@/features/events/EventDetailScreen";
import { FlextvEventDetailScreen } from "@/features/events/FlextvEventScreens";
import { FLEXTV_SITE } from "@/lib/flextv/mode";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";
import { getEvent } from "@/services/events/events";
import { getFlextvEvent } from "@/services/events/flextvEvents";

// Code-first (no Figma frame): 이벤트 상세
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

// One read per request for the title and the page.
const readEvent = cache(getEvent);
const readFlextvEvent = cache(getFlextvEvent);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const event = FLEXTV_SITE ? await readFlextvEvent(id) : await readEvent(id);
  const t = await getT();
  return { title: event?.title ? t("events.metaEvent", { title: event.title }) : t("events.meta") };
}

export default async function Page({ params }: { params: Params }) {
  // With FLEXTV (phase 9): FLEXTV's event, joined on FLEXTV.
  if (FLEXTV_SITE) {
    const event = await readFlextvEvent((await params).id);
    if (!event) notFound();
    return <FlextvEventDetailScreen event={event} />;
  }
  const [event, session] = await Promise.all([readEvent((await params).id), getSession()]);
  if (!event) notFound();
  return <EventDetailScreen event={event} signedIn={!!session} />;
}
