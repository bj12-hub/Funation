"use client";

import { PageError } from "@/components/layout/PageError";

/** ERROR state for 로그인 · 회원가입 · 비밀번호 찾기 (the header stays). */
export default function AuthError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError title="페이지를 불러오지 못했어요" onRetry={reset} />;
}
