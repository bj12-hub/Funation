import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessagesScreen } from "@/features/messages/MessagesScreen";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";
import { getMailbox, getMessageRecipients } from "@/services/messages/messages";

// Code-first (no Figma frame): 쪽지 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("messages.meta") };
}
export const dynamic = "force-dynamic";

type Search = { box?: string; q?: string; page?: string; size?: string; to?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const [session, view, recipients] = await Promise.all([getSession(), getMailbox(params), getMessageRecipients(params.to)]);
  if (!session || !view || !recipients) redirect("/login?next=/messages");
  const composeTo = typeof params.to === "string" && recipients.some((r) => r.id === params.to) ? params.to : null;
  return (
    <>
      {/* A new box, page, size or search is a new list: selections from the old one must not carry over. */}
      <MessagesScreen key={`${view.box}-${view.page}-${view.size}-${view.q}`} view={view} recipients={recipients} composeTo={composeTo} />
    </>
  );
}
