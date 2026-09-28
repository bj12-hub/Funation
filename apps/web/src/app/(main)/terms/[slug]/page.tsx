import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/layout/ComingSoon";

// Figma: 약관 상세 예시 722:3 (terms text not provided yet)
const TERMS: Record<string, string> = {
  youth: "청소년 보호정책",
  service: "서비스 이용약관",
  privacy: "개인정보 처리 방침",
  marketing: "광고성 정보 수신 및 마케팅 활용 동의"
};

export function generateStaticParams() {
  return Object.keys(TERMS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${TERMS[slug] ?? "약관"} | Funation` };
}

export default async function TermsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = TERMS[slug];
  if (!title) notFound();
  return <ComingSoon title={title} description="약관 전문은 확정되는 대로 게시됩니다." />;
}
