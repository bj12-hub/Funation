import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ContentManager } from "@/features/admin/content/ContentManager";
import { listFaqsAdmin, listNoticesAdmin } from "@/services/admin/content";

// Code-first (no Figma frame): 콘텐츠 관리 (공지 · FAQ) — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "콘텐츠 관리 | Somnation 관리자", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [notices, faqs] = await Promise.all([listNoticesAdmin(), listFaqsAdmin()]);
  if (!notices || !faqs) redirect("/admin/login");
  return <ContentManager tab={(await searchParams).tab === "faq" ? "faq" : "notices"} notices={notices} faqs={faqs} />;
}
