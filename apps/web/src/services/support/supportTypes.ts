/**
 * 고객센터 — tabs follow funnation (공지사항 · 자주 묻는 질문 · 1:1 문의); code-first beyond Figma 4:7.
 * Client-safe types and constants. Copy is ours; answers that depend on undecided policy stay empty (TBD).
 */

export const SUPPORT_TABS = [
  { key: "notices", label: "공지사항" },
  { key: "faq", label: "자주 묻는 질문" },
  { key: "inquiry", label: "1:1 문의" }
] as const;
export type SupportTab = (typeof SUPPORT_TABS)[number]["key"];
export const parseSupportTab = (v: unknown): SupportTab => (SUPPORT_TABS.some((t) => t.key === v) ? (v as SupportTab) : "notices");

export const NOTICE_CATEGORY_LABEL = { GENERAL: "일반", UPDATE: "업데이트", CHECK: "점검" } as const;
export type NoticeCategory = keyof typeof NOTICE_CATEGORY_LABEL;

export type Notice = {
  id: string;
  category: NoticeCategory;
  important: boolean;
  title: string;
  summary: string;
  body: string[];
  /** yyyy-mm-dd */
  date: string;
  views: number;
};

export const FAQ_CATEGORIES = [
  { key: "ACCOUNT", label: "계정/로그인" },
  { key: "CHARGE", label: "결제/충전" },
  { key: "DONATION", label: "후원" },
  { key: "SETTLEMENT", label: "정산/출금" },
  { key: "CREATOR", label: "크리에이터" },
  { key: "WIDGET", label: "위젯" },
  { key: "EVENT", label: "이벤트" },
  { key: "COMMUNITY", label: "커뮤니티" },
  { key: "GENERAL", label: "일반" }
] as const;
export type FaqCategory = (typeof FAQ_CATEGORIES)[number]["key"];
export const isFaqCategory = (v: unknown): v is FaqCategory => FAQ_CATEGORIES.some((c) => c.key === v);
export const faqCategoryLabel = (c: FaqCategory) => FAQ_CATEGORIES.find((x) => x.key === c)!.label;

export type FaqItem = {
  id: string;
  category: FaqCategory;
  question: string;
  /** `null` until the answer is written (most answers depend on TBD policies). */
  answer: string | null;
  link?: { href: string; label: string };
};

export const INQUIRY_CATEGORIES = FAQ_CATEGORIES;
export const INQUIRY_TITLE_MAX = 60;
export const INQUIRY_BODY_MAX = 2000;

export type InquiryStatus = "RECEIVED" | "ANSWERED";
export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = { RECEIVED: "접수", ANSWERED: "답변 완료" };

export type Inquiry = { id: string; category: FaqCategory; title: string; body: string; createdAt: string; status: InquiryStatus; answer: string | null };

export type InquiryResult = { status: "SUBMITTED"; id: string } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };
