"use server";

import { FLEXTV_SITE } from "@/lib/flextv/mode";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { flextvMyInquiries, flextvSubmitInquiry } from "./flextvSupport";
import { inquiryAccountKey as accountKey, inquiryStore } from "./inquiryCore";
import { INQUIRY_BODY_MAX, INQUIRY_TITLE_MAX, isFaqCategory, type Inquiry, type InquiryResult } from "./supportTypes";

/**
 * 1:1 문의 Server Actions — code-first (funnation 고객센터 1:1 문의). Members submit and see their own
 * inquiries. Answers come from an operator console (TBD), so the mock only records 접수.
 * `requestId` makes a double submit create one inquiry. With FLEXTV (phase 7) the member's FLEXTV 1:1 문의, written
 * here as on FLEXTV's form since phase 9 (`submitFlextvInquiry`, ./flextvSupport.ts).
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Support API is not connected yet.");
};

/**
 * Inquiries belong to the account that wrote them (./inquiryCore.ts): a 재가입 account never reads the withdrawn
 * account's, which stay stored for the operators for the 분쟁 처리 기록 period (account/retentionPolicy.ts, 기본값).
 */
export async function listMyInquiries(): Promise<Inquiry[] | null> {
  if (FLEXTV_SITE) return flextvMyInquiries();
  assertMock();
  const session = await getSession();
  if (!session) return null;
  return [...(inquiryStore().byUser[accountKey(session.userId)] ?? [])]
    .reverse()
    .map((q) => ({ id: q.id, category: q.category, title: q.title, body: q.body, createdAt: q.createdAt, status: q.status, answer: q.answer }));
}

/** With FLEXTV (phase 9): FLEXTV's 1:1 문의 form — `requestId`, `category` (FLEXTV's 유형), `title`, `content`, `image`. */
export async function submitFlextvInquiry(formData: FormData): Promise<InquiryResult> {
  if (!FLEXTV_SITE || !(formData instanceof FormData)) return { status: "INVALID", message: "잘못된 요청입니다." };
  return flextvSubmitInquiry(formData);
}

export async function submitInquiry(input: unknown): Promise<InquiryResult> {
  // With FLEXTV the form sends FLEXTV's 유형 and a picture: submitFlextvInquiry.
  if (FLEXTV_SITE) return { status: "INVALID", message: "잘못된 요청입니다." };
  assertMock();
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  await mockDelay(300);
  // Request ids belong to the member: another member's id never returns their inquiry. Nothing awaits from here to the
  // write, so a double submit creates one inquiry.
  const account = accountKey(session.userId);
  const store = inquiryStore();
  const requestKey = `${account}:${v.requestId}`;
  const done = store.requests[requestKey];
  if (done) return { status: "SUBMITTED", id: done };
  if (!isFaqCategory(v.category)) return { status: "INVALID", message: "문의 유형을 골라 주세요." };
  const title = typeof v.title === "string" ? v.title.trim() : "";
  const body = typeof v.body === "string" ? v.body.trim() : "";
  if (!title || title.length > INQUIRY_TITLE_MAX) return { status: "INVALID", message: `제목을 1~${INQUIRY_TITLE_MAX}자로 입력해 주세요.` };
  if (body.length < 10 || body.length > INQUIRY_BODY_MAX) return { status: "INVALID", message: `내용을 10~${INQUIRY_BODY_MAX}자로 입력해 주세요.` };
  const id = `iq-${Date.now().toString(36)}-${Object.keys(store.requests).length}`;
  (store.byUser[account] ??= []).push({ id, category: v.category, title, body, createdAt: new Date().toISOString(), status: "RECEIVED", answer: null });
  store.requests[requestKey] = id;
  return { status: "SUBMITTED", id };
}
