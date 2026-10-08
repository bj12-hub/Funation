import type { Metadata } from "next";
import { SupportScreen } from "@/features/support";
import { getFaqs } from "@/services/support/faq";
import { listMyInquiries } from "@/services/support/inquiry";
import { getNotices } from "@/services/support/notices";
import { isFaqCategory, parseSupportTab, type FaqCategory } from "@/services/support/supportTypes";

// Figma: 고객센터 4:7; tabs follow funnation 고객센터 (공지사항 · 자주 묻는 질문 · 1:1 문의).
export const metadata: Metadata = { title: "고객센터 | Ssumnation" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const query = one(raw.q)?.trim().slice(0, 50) || undefined;
  // A search always shows the FAQ.
  const tab = query ? "faq" : parseSupportTab(one(raw.tab));
  const rawCategory = one(raw.category);
  const category: FaqCategory | undefined = isFaqCategory(rawCategory) ? rawCategory : undefined;
  const [notices, faqs, inquiries] = await Promise.all([
    tab === "notices" ? getNotices() : Promise.resolve([]),
    tab === "faq" ? getFaqs({ query, category }) : Promise.resolve([]),
    tab === "inquiry" ? listMyInquiries() : Promise.resolve(null)
  ]);
  return <SupportScreen tab={tab} notices={notices} faqs={faqs} query={query} category={category} inquiries={inquiries} />;
}
