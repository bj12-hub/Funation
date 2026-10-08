import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PostEditor } from "@/features/community/PostEditor";
import { getSession } from "@/lib/session";
import { getPost } from "@/services/community/community";

// Code-first (no Figma frame): 커뮤니티 글 수정 (author only; the server re-checks on save)
export const metadata: Metadata = { title: "글 수정 | Ssumnation 커뮤니티" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getSession())) redirect(`/login?next=/community/${id}/edit`);
  const post = await getPost(id);
  if (!post) notFound();
  if (!post.mine) redirect(`/community/${id}`);
  return <PostEditor initial={{ id: post.id, category: post.category, title: post.title, body: post.body }} />;
}
