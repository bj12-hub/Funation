import { requestFrom } from "@/lib/flextv/auth";
import { createQueue } from "@/lib/flextv/queue";
import { requestDeviceContext } from "@/lib/flextv/request";
import { FLEXTV_INQUIRY_BODY_MAX, FLEXTV_INQUIRY_IMAGE_MAX_BYTES, FLEXTV_INQUIRY_IMAGE_TYPES, FLEXTV_INQUIRY_TITLE_MAX } from "@/lib/flextv/rules";
import { fetchFaqs, fetchInquiryCategories, fetchMyInquiries, fetchNotice, fetchNotices, postInquiry, type FlextvNotice, type FlextvQuestion, type InquiryCategory } from "@/lib/flextv/support";
import { getFlextvAccessToken, getSession } from "@/lib/session";
import { matchesContent } from "@/services/creator/assetCore";
import type { FaqItem, Inquiry, InquiryResult, Notice } from "./supportTypes";

/**
 * 고객센터 with FLEXTV (phase 7, docs/development/flextv-backend.md "7단계"): FLEXTV's 공지사항 and 자주 묻는 질문, and
 * the member's FLEXTV 1:1 문의. FLEXTV's notices and questions have no Ssumnation category, summary or view count.
 * ./notices.ts, ./faq.ts and ./inquiry.ts delegate here. Since phase 9 a 1:1 문의 is written here as on FLEXTV's form:
 * its 유형, 제목, 내용 and one picture.
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

/* ── 1:1 문의 작성 (phase 9) ─────────────────────────────── */

/** FLEXTV's 1:1 문의 유형; null when FLEXTV does not answer (the page then links FLEXTV's own form). */
export async function flextvInquiryCategories(): Promise<InquiryCategory[] | null> {
  try {
    const categories = await fetchInquiryCategories();
    return categories.length > 0 ? categories : null;
  } catch {
    return null;
  }
}

const serialize = createQueue("inquiry");
const REQUEST_TTL_MS = 30 * 60 * 1000;
const g = globalThis as typeof globalThis & { __ssumnationFlextvInquiryRequests?: Map<string, { at: number; result: Promise<InquiryResult> }> };
const requests = (g.__ssumnationFlextvInquiryRequests ??= new Map());
const IMAGE_TYPES: readonly string[] = FLEXTV_INQUIRY_IMAGE_TYPES;

/**
 * A 1:1 문의 as FLEXTV's form sends it. `requestId` keeps a double submit (or a retry after a lost answer) to one 문의
 * while FLEXTV's answer is kept; a refused or unclear one may be sent again. The id is taken before anything is awaited,
 * so a second submit with it waits for the first.
 */
export async function flextvSubmitInquiry(formData: FormData): Promise<InquiryResult> {
  const [session, token] = await Promise.all([getSession(), getFlextvAccessToken()]);
  if (!session || !token) return { status: "UNAUTHORIZED" };
  const requestId = formData.get("requestId");
  if (typeof requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const key = `${session.userId}:${requestId}`;
  const now = Date.now();
  for (const [k, v] of requests) if (now - v.at > REQUEST_TTL_MS) requests.delete(k);
  const done = requests.get(key);
  if (done) return done.result;
  const result = submitInquiry(token, formData);
  requests.set(key, { at: now, result });
  result.then(
    (r) => r.status !== "SUBMITTED" && requests.delete(key),
    () => requests.delete(key)
  );
  return result;
}

async function submitInquiry(token: string, formData: FormData): Promise<InquiryResult> {
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const category = field("category");
  const title = field("title");
  const content = field("content");
  if (!title || title.length > FLEXTV_INQUIRY_TITLE_MAX) return { status: "INVALID", message: `제목을 1~${FLEXTV_INQUIRY_TITLE_MAX}자로 입력해 주세요.` };
  if (!content || content.length > FLEXTV_INQUIRY_BODY_MAX) return { status: "INVALID", message: `내용을 1~${FLEXTV_INQUIRY_BODY_MAX}자로 입력해 주세요.` };
  const file = formData.get("image");
  let image: { blob: Blob; filename: string } | null = null;
  if (file instanceof File && file.size > 0) {
    // The bytes must really be that image type (a renamed file is refused).
    if (!IMAGE_TYPES.includes(file.type) || file.size > FLEXTV_INQUIRY_IMAGE_MAX_BYTES || !matchesContent(Buffer.from(await file.arrayBuffer()), file.type)) {
      return { status: "INVALID", message: "첨부 사진은 20MB 미만의 PNG, JPG 이미지만 올릴 수 있어요." };
    }
    image = { blob: file, filename: file.name || "image" };
  }
  const categories = await fetchInquiryCategories();
  if (!categories.some((c) => c.value === category)) return { status: "INVALID", message: "문의 유형을 골라 주세요." };
  const caller = requestFrom(await requestDeviceContext());
  return serialize(token, async (): Promise<InquiryResult> => {
    const posted = await postInquiry(token, { title, content, category, image }, caller);
    if (posted.kind === "UNAUTHORIZED") return { status: "UNAUTHORIZED" };
    return posted.kind === "OK" ? { status: "SUBMITTED", id: posted.id } : { status: "INVALID", message: posted.message };
  });
}
