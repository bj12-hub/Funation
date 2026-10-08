import { USE_MOCK, mockDelay } from "@/lib/mock";
import type { FaqCategory, FaqItem } from "./supportTypes";

export type { FaqItem } from "./supportTypes";

/**
 * Support FAQ contract. Figma: 고객센터 4:7 (route `/support`); categories follow funnation 자주 묻는 질문.
 * Answers describe what the app does today; anything depending on an undecided policy (fees, schedules,
 * refunds, identity rules) stays `null` (see CLAUDE.md §14).
 */
export async function getFaqs(input: { query?: string; category?: FaqCategory } = {}): Promise<FaqItem[]> {
  if (!USE_MOCK) throw new Error("Support API is not connected yet.");
  await mockDelay(200);
  const keyword = input.query?.trim().toLowerCase();
  return faqStore().items.filter(
    (f) =>
      (!input.category || f.category === input.category) &&
      (!keyword || f.question.toLowerCase().includes(keyword) || (f.answer?.toLowerCase().includes(keyword) ?? false))
  );
}

const g = globalThis as typeof globalThis & { __ssumnationMockFaqsV1?: { items: FaqItem[] } };
/** Server-only store shared with services/admin/content.ts (operators edit FAQs in the admin console). */
export const faqStore = () => (g.__ssumnationMockFaqsV1 ??= { items: structuredClone(MOCK_FAQS) });

const MOCK_FAQS: FaqItem[] = [
  { id: "signup", category: "ACCOUNT", question: "회원가입은 어떻게 하나요?", answer: "로그인 화면의 ‘회원가입’에서 약관 동의 후 이메일로 가입할 수 있어요.", link: { href: "/signup", label: "회원가입" } },
  {
    id: "password",
    category: "ACCOUNT",
    question: "비밀번호를 잊어버렸어요.",
    answer: "로그인 화면의 ‘비밀번호 찾기’에서 인증 후 새 비밀번호를 설정할 수 있어요.",
    link: { href: "/password-reset", label: "비밀번호 찾기" }
  },
  { id: "locked", category: "ACCOUNT", question: "로그인이 제한되었다고 나와요.", answer: "비밀번호를 여러 번 틀리면 계정 보호를 위해 로그인이 제한돼요. 비밀번호를 재설정하면 다시 로그인할 수 있어요.", link: { href: "/password-reset", label: "비밀번호 재설정" } },
  { id: "profile", category: "ACCOUNT", question: "닉네임이나 프로필 사진을 바꾸고 싶어요.", answer: "마이 → 내 정보에서 닉네임과 프로필 사진을 바꿀 수 있어요.", link: { href: "/mypage", label: "내 정보" } },
  { id: "charge", category: "CHARGE", question: "FN은 어떻게 충전하나요?", answer: "사이드 메뉴의 ‘FN 충전’ 버튼이나 지갑에서 충전할 수 있어요.", link: { href: "/wallet", label: "지갑" } },
  { id: "charge-history", category: "CHARGE", question: "충전 · 사용 내역은 어디서 보나요?", answer: "마이 → 지갑에서 충전 · 사용 · 환불 · 적립 내역을 볼 수 있어요.", link: { href: "/wallet", label: "지갑" } },
  { id: "refund", category: "CHARGE", question: "충전한 FN을 환불할 수 있나요?", answer: null },
  { id: "donate", category: "DONATION", question: "후원은 어떻게 하나요?", answer: "크리에이터 채널에서 ‘후원하기’를 누르고 후원 유형과 금액을 골라 보내면 돼요.", link: { href: "/creators", label: "크리에이터 찾기" } },
  { id: "nickname", category: "DONATION", question: "후원할 때 다른 이름을 쓰고 싶어요.", answer: "마이 → 별명 관리에서 별명을 만들고, 후원 패널에서 사용할 별명을 고를 수 있어요.", link: { href: "/mypage/nicknames", label: "별명 관리" } },
  { id: "donation-history", category: "DONATION", question: "내 후원 내역은 어디서 보나요?", answer: "마이 → 후원 내역에서 검색 · 금액 · 기간으로 찾아볼 수 있어요.", link: { href: "/wallet/donations", label: "후원 내역" } },
  { id: "platform", category: "DONATION", question: "SOOP · FlexTV 크리에이터에게도 후원할 수 있나요?", answer: "사이드 메뉴의 ‘플랫폼 후원’에서 SOOP · FlexTV 크리에이터를 찾아 후원할 수 있어요.", link: { href: "/donation/soop", label: "SOOP 후원" } },
  { id: "settle-when", category: "SETTLEMENT", question: "후원금 정산은 언제 되나요?", answer: null },
  { id: "settle-how", category: "SETTLEMENT", question: "정산을 받으려면 무엇이 필요한가요?", answer: "스튜디오 → 정산 현황의 체크리스트(본인인증 · 정산 자료 등록 · 심사 · 계좌)를 모두 마치면 정산을 신청할 수 있어요.", link: { href: "/creator/settlement", label: "정산 현황" } },
  { id: "creator", category: "CREATOR", question: "크리에이터가 되려면 어떻게 하나요?", answer: "사이드 메뉴의 ‘내 채널 만들기’에서 채널을 만들면 크리에이터 스튜디오를 쓸 수 있어요.", link: { href: "/channel/new", label: "내 채널 만들기" } },
  { id: "obs", category: "WIDGET", question: "위젯을 방송 화면(OBS)에 넣으려면요?", answer: "스튜디오 → 위젯 → 오버레이 주소에서 주소를 복사해 OBS 브라우저 소스에 붙여 넣으면 돼요. 주소는 계정 전용이니 공유하지 마세요.", link: { href: "/creator/widgets/overlays", label: "오버레이 주소" } },
  { id: "event", category: "EVENT", question: "이벤트는 어디서 참여하나요?", answer: "사이드 메뉴의 ‘이벤트’에서 진행 중인 이벤트에 참여할 수 있어요.", link: { href: "/events", label: "이벤트" } },
  { id: "community", category: "COMMUNITY", question: "커뮤니티 글은 누가 쓸 수 있나요?", answer: "로그인한 회원이면 누구나 커뮤니티에 글과 댓글을 쓸 수 있어요.", link: { href: "/community", label: "커뮤니티" } },
  { id: "theme", category: "GENERAL", question: "화면을 밝게 바꿀 수 있나요?", answer: "상단의 ☀️ / 🌙 버튼으로 라이트 · 다크 모드를 바꿀 수 있어요." }
];
