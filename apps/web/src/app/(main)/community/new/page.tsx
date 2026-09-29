import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PostEditor } from "@/features/community/PostEditor";
import { getSession } from "@/lib/session";

// Code-first (no Figma frame): 커뮤니티 글쓰기
export const metadata: Metadata = { title: "글쓰기 | Funation 커뮤니티" };
export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await getSession())) redirect("/login?next=/community/new");
  return <PostEditor initial={null} />;
}
