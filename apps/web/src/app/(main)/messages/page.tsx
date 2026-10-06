import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessagesScreen } from "@/features/messages/MessagesScreen";
import { getMyAccount } from "@/services/account/myAccount";
import { getMailbox, getMessageRecipients } from "@/services/messages/messages";

// Code-first (no Figma frame): 쪽지 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "쪽지 | Somnation" };
export const dynamic = "force-dynamic";

type Search = { box?: string; q?: string; page?: string; size?: string; to?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const [account, view, recipients] = await Promise.all([getMyAccount(), getMailbox(params), getMessageRecipients()]);
  if (!account || !view || !recipients) redirect("/login?next=/messages");
  const composeTo = typeof params.to === "string" && recipients.some((r) => r.id === params.to) ? params.to : null;
  return (
    <>
      {/* A new box, page, size or search is a new list: selections from the old one must not carry over. */}
      <MessagesScreen key={`${view.box}-${view.page}-${view.size}-${view.q}`} view={view} recipients={recipients} composeTo={composeTo} />
    </>
  );
}
