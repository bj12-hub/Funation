"use client";

import { PageError } from "@/components/layout/PageError";

/** ERROR state for the supporter ranking. */
export default function HallOfFameError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError title="명예의 전당을 불러오지 못했습니다" onRetry={reset} />;
}
