"use client";

import { PageError } from "@/components/layout/PageError";

/** ERROR state for the attendance page. */
export default function AttendanceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError title="출석 현황을 불러오지 못했습니다" onRetry={reset} />;
}
