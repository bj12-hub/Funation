"use client";

import { PageError } from "@/components/layout/PageError";

/** ERROR state for the support page. */
export default function SupportError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError title="고객센터 정보를 불러오지 못했습니다" onRetry={reset} />;
}
