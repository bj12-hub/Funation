import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventDetailScreen } from "@/features/events/EventDetailScreen";
import { getSession } from "@/lib/session";
import { getEvent } from "@/services/events/events";

// Code-first (no Figma frame): 이벤트 상세
export const metadata: Metadata = { title: "이벤트 | Funation" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [event, session] = await Promise.all([getEvent((await params).id), getSession()]);
  if (!event) notFound();
  return <EventDetailScreen event={event} signedIn={!!session} />;
}
