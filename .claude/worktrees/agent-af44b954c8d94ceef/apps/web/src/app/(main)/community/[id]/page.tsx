import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PostScreen } from "@/features/community/PostScreen";
import { getSession } from "@/lib/session";
import { getPost } from "@/services/community/community";

// Code-first (no Figma frame): 커뮤니티 게시글
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

// One read per request for the title and the page (reading a post counts a view).
const readPost = cache(getPost);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const post = await readPost((await params).id);
  return { title: post ? `${post.title} | 커뮤니티 | Somnation` : "커뮤니티 | Somnation" };
}

export default async function Page({ params }: { params: Params }) {
  const [post, session] = await Promise.all([readPost((await params).id), getSession()]);
  if (!post) notFound();
  return <PostScreen post={post} signedIn={!!session} />;
}
