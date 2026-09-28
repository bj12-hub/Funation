"use client";

import { PageError } from "@/components/layout/PageError";

/** ERROR state for the home feed. */
export default function HomeError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError title="홈 화면을 불러오지 못했습니다" onRetry={reset} />;
}
