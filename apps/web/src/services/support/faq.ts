import { USE_MOCK, mockDelay } from "@/lib/mock";

/**
 * Support FAQ contract.
 * Figma: 고객센터 4:7 (route `/support`) — "자주 묻는 질문 TOP 5"
 */

export type FaqItem = {
  id: string;
  question: string;
  /** `null` until the answer is written (most answers depend on TBD policies). */
  answer: string | null;
  link?: { href: string; label: string };
};

/** Top questions, or the questions matching `query`. */
export async function getFaqs(query?: string): Promise<FaqItem[]> {
  if (!USE_MOCK) throw new Error("Support API is not connected yet.");
  await mockDelay(200);
  const keyword = query?.trim().toLowerCase();
  if (!keyword) return MOCK_FAQS;
  return MOCK_FAQS.filter((f) => f.question.toLowerCase().includes(keyword) || f.answer?.toLowerCase().includes(keyword));
}

// ── Mock data: questions from Figma 4:7 ───────────────────────────────────────
// Answers about donation, creator registration, settlement and membership depend on
// undecided policies (see docs/product/open-decisions.md) and are intentionally empty.

const MOCK_FAQS: FaqItem[] = [
  { id: "donate", question: "썸네이션 후원은 어떻게 하나요?", answer: null },
  { id: "creator", question: "크리에이터 등록은 어떻게 하나요?", answer: null },
  { id: "settlement", question: "후원금 정산은 언제 되나요?", answer: null },
  { id: "membership", question: "구독 멤버십 혜택은 무엇인가요?", answer: null },
  {
    id: "password",
    question: "계정 비밀번호를 잊어버렸어요",
    answer: "로그인 화면의 ‘비밀번호 찾기’에서 이메일 또는 휴대폰 인증으로 새 비밀번호를 설정할 수 있습니다.",
    link: { href: "/password-reset", label: "비밀번호 찾기" }
  }
];
