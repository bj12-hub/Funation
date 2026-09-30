import type { Metadata } from "next";
import { ContentManager } from "@/features/content/ContentManager";
import { loadFaqs, loadNotices } from "@/lib/queries";

export const metadata: Metadata = { title: "콘텐츠 관리 | Somnation 관리자" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [notices, faqs] = await Promise.all([loadNotices(), loadFaqs()]);
  if (!notices || !faqs) throw new Error("콘텐츠를 불러오지 못했어요.");
  return <ContentManager tab={(await searchParams).tab === "faq" ? "faq" : "notices"} notices={notices} faqs={faqs} />;
}
