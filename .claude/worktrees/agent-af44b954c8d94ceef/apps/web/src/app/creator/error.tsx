"use client";

import { PageError } from "@/components/layout/PageError";

/** ERROR state for the creator studio. */
export default function CreatorError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError title="크리에이터 정보를 불러오지 못했습니다" onRetry={reset} />;
}
