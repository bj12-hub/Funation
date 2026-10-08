import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { EventDetailScreen } from "@/features/events/EventDetailScreen";
import { getSession } from "@/lib/session";
import { getEvent } from "@/services/events/events";

// Code-first (no Figma frame): 이벤트 상세
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

// One read per request for the title and the page.
const readEvent = cache(getEvent);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const event = await readEvent((await params).id);
  return { title: event ? `${event.title} | 이벤트 | Ssumnation` : "이벤트 | Ssumnation" };
}

export default async function Page({ params }: { params: Params }) {
  const [event, session] = await Promise.all([readEvent((await params).id), getSession()]);
  if (!event) notFound();
  return <EventDetailScreen event={event} signedIn={!!session} />;
}
