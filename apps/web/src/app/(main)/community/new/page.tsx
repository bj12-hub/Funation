import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PostEditor } from "@/features/community/PostEditor";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";

// Code-first (no Figma frame): 커뮤니티 글쓰기
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("community.metaNew") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await getSession())) redirect("/login?next=/community/new");
  return <PostEditor initial={null} />;
}
