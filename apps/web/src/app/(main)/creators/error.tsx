"use client";

import { PageError } from "@/components/layout/PageError";

/** ERROR state for the creator directory. */
export default function CreatorsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError title="크리에이터 목록을 불러오지 못했습니다" onRetry={reset} />;
}
