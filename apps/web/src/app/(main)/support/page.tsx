import type { Metadata } from "next";
import { SupportScreen } from "@/features/support";
import { getFaqs } from "@/services/support/faq";

// Figma: 고객센터 4:7
export const metadata: Metadata = { title: "고객센터 | Funation" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 50) || undefined : undefined;
  const faqs = await getFaqs(query);
  return <SupportScreen faqs={faqs} query={query} />;
}
