"use client";

import { PageError } from "@/components/layout/PageError";

/** ERROR state for the platform donation pages (Figma 817:7826). */
export default function DonationError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError title="페이지를 불러오지 못했습니다" onRetry={reset} />;
}
