"use client";

import { PageError } from "@/components/layout/PageError";

/** Fallback ERROR state for site pages without their own error boundary (header and menu stay). */
export default function MainError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError title="페이지를 불러오지 못했어요" onRetry={reset} />;
}
