"use client";

import { PageError } from "@/components/layout/PageError";

/** ERROR state for my page. */
export default function MyPageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError title="회원 정보를 불러오지 못했습니다" onRetry={reset} />;
}
