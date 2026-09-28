"use client";

import { PageError } from "@/components/layout/PageError";

/** ERROR state for the live lists. */
export default function LiveError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError title="라이브 목록을 불러오지 못했습니다" onRetry={reset} />;
}
