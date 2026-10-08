import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TermsDocument } from "@/features/terms/TermsDocument";
import { isTermsSlug, TERMS_DOCS, TERMS_SLUGS } from "@/features/terms/termsOutline";

// Figma: 약관 상세 예시 722:3 (terms text not provided) — 초안 bodies with the draft banner until legal review (2026-10-08).
// Slugs: footer (service · privacy · youth · operation 727:3200), 회원가입 (marketing), 채널 만들기 (creator),
// FN 충전 약관 (refund).

// Only the listed documents exist; any other slug is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return TERMS_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${isTermsSlug(slug) ? TERMS_DOCS[slug].title : "약관"} | Somnation` };
}

export default async function TermsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isTermsSlug(slug)) notFound();
  return <TermsDocument slug={slug} />;
}
