import type { Metadata } from "next";
import { BoardScreen } from "@/features/community/BoardScreen";
import { getSession } from "@/lib/session";
import { getBoard } from "@/services/community/community";

// Code-first (no Figma frame): 커뮤니티 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "커뮤니티 | Ssumnation" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ category?: string; q?: string; page?: string }> }) {
  const [view, session] = await Promise.all([getBoard(await searchParams), getSession()]);
  return <BoardScreen view={view} signedIn={!!session} />;
}
