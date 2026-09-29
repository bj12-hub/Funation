import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostScreen } from "@/features/community/PostScreen";
import { getSession } from "@/lib/session";
import { getPost } from "@/services/community/community";

// Code-first (no Figma frame): 커뮤니티 게시글
export const metadata: Metadata = { title: "커뮤니티 | Somnation" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [post, session] = await Promise.all([getPost((await params).id), getSession()]);
  if (!post) notFound();
  return <PostScreen post={post} signedIn={!!session} />;
}
