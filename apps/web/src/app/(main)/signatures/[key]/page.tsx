import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicSignaturesView } from "@/features/signaturePage/PublicSignaturesView";
import { getT } from "@/lib/i18n/server";
import { USE_MOCK } from "@/lib/mock";
import { publicSignaturePage } from "@/services/donations/signatureCore";

// Code-first (no Figma frame): 공개 시그니처 페이지 (StreamDonate 참고, 2026-10-25) — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("signaturePage.meta"), robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

/** Open to anyone with the address (no login); a page that is off, a wrong key or a closed account looks like any 404. */
export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  if (!USE_MOCK) notFound();
  const page = publicSignaturePage((await params).key);
  if (!page) notFound();
  return <PublicSignaturesView page={page} />;
}
