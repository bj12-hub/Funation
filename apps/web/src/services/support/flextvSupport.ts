import { fetchFaqs, fetchMyInquiries, fetchNotice, fetchNotices, type FlextvNotice, type FlextvQuestion } from "@/lib/flextv/support";
import { getFlextvAccessToken } from "@/lib/session";
import type { FaqItem, Inquiry, Notice } from "./supportTypes";

/**
 * 고객센터 with FLEXTV (phase 7, docs/development/flextv-backend.md "7단계"): FLEXTV's 공지사항 and 자주 묻는 질문, and
 * the member's FLEXTV 1:1 문의 — written on FLEXTV's site, like its refunds. FLEXTV's notices and questions have no
 * Ssumnation category, summary or view count. ./notices.ts, ./faq.ts and ./inquiry.ts delegate here.
 */

export const noticeOf = (n: FlextvNotice): Notice => ({
  id: n.id,
  category: "GENERAL",
  important: n.important,
  title: n.title,
  summary: "",
  body: n.paragraphs,
  date: n.date,
  views: 0
});

/** A FAQ keeps its answer in the text (or in the answer). Paragraphs are separate lines. */
export const faqOf = (q: FlextvQuestion): FaqItem => ({
  id: q.id,
  category: "GENERAL",
  question: q.title,
  answer: (q.answer.length > 0 ? q.answer : q.paragraphs).join("\n") || null
});

export const inquiryOf = (q: FlextvQuestion): Inquiry => ({
  id: q.id,
  category: "GENERAL",
  title: q.title,
  body: q.paragraphs.join("\n"),
  createdAt: q.createdAt,
  status: q.answered ? "ANSWERED" : "RECEIVED",
  answer: q.answer.join("\n") || null
});

export const flextvNotices = async () => (await fetchNotices()).map(noticeOf);

export async function flextvNotice(id: string): Promise<Notice | null> {
  const notice = await fetchNotice(id);
  return notice ? noticeOf(notice) : null;
}

export const flextvFaqs = async (query?: string) => (await fetchFaqs(query?.trim() || undefined)).map(faqOf);

export async function flextvMyInquiries(): Promise<Inquiry[] | null> {
  const token = await getFlextvAccessToken();
  const list = token ? await fetchMyInquiries(token) : null;
  return list ? list.map(inquiryOf) : null;
}
