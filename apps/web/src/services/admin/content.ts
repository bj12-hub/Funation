import { USE_MOCK } from "@/lib/mock";
import { toDateString } from "@/lib/period";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { notify } from "@/services/notifications/notificationCore";
import { faqStore } from "@/services/support/faq";
import { noticeStore } from "@/services/support/notices";
import { FAQ_CATEGORIES, NOTICE_CATEGORY_LABEL, type FaqItem, type Notice } from "@/services/support/supportTypes";
import type { AdminActor } from "./adminTypes";
import { recordAudit } from "./auditCore";
import { FAQ_LIMITS, NOTICE_LIMITS, type ContentResult } from "./contentTypes";

/**
 * 콘텐츠 관리 API logic — code-first (called by `/api/admin/*`). Admin app screens `/admin/content` (`?tab=notices|faq`). Admin only; the
 * 고객센터 reads the same stores, so changes show on the site immediately. Every change is audited.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Admin content API is not connected yet.");
};
const obj = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const forbidden = (...texts: string[]) => texts.some((t) => MOCK_FORBIDDEN_WORDS.some((w) => t.toLowerCase().includes(w)));
const g = globalThis as typeof globalThis & { __funationMockContentRequestsV1?: Record<string, string> };
const requests = (g.__funationMockContentRequestsV1 ??= {});

export async function listNoticesAdmin(): Promise<Notice[] | null> {
  assertMock();
  return [...noticeStore().items].sort((a, b) => Number(b.important) - Number(a.important) || b.date.localeCompare(a.date)).map((n) => structuredClone(n));
}

export async function saveNotice(admin: AdminActor, input: unknown): Promise<ContentResult> {
  assertMock();
  const v = obj(input);
  const id = typeof v.id === "string" && v.id ? v.id : null;
  if (!id) {
    if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
    if (requests[v.requestId]) return { status: "OK", id: requests[v.requestId] };
  }
  const title = str(v.title);
  const summary = str(v.summary);
  const bodyText = str(v.body);
  if (!(typeof v.category === "string" && Object.hasOwn(NOTICE_CATEGORY_LABEL, v.category))) return { status: "INVALID", message: "분류를 골라 주세요." };
  if (!title || title.length > NOTICE_LIMITS.title) return { status: "INVALID", message: `제목을 1~${NOTICE_LIMITS.title}자로 입력해 주세요.` };
  if (!summary || summary.length > NOTICE_LIMITS.summary) return { status: "INVALID", message: `요약을 1~${NOTICE_LIMITS.summary}자로 입력해 주세요.` };
  if (!bodyText || bodyText.length > NOTICE_LIMITS.body) return { status: "INVALID", message: `본문을 1~${NOTICE_LIMITS.body}자로 입력해 주세요.` };
  if (typeof v.important !== "boolean") return { status: "INVALID", message: "중요 여부를 확인해 주세요." };
  if (forbidden(title, summary, bodyText)) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  const body = bodyText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const items = noticeStore().items;
  const next = { category: v.category as Notice["category"], important: v.important, title, summary, body };
  if (id) {
    const existing = items.find((n) => n.id === id);
    if (!existing) return { status: "NOT_FOUND" };
    Object.assign(existing, next);
    recordAudit(admin, "CONTENT_UPDATE", `notice:${id}`, `공지 수정 · ${title}`);
    return { status: "OK", id };
  }
  const newId = `n-${Date.now().toString(36)}`;
  items.push({ id: newId, ...next, date: toDateString(new Date()), views: 0 });
  requests[v.requestId as string] = newId;
  recordAudit(admin, "CONTENT_UPDATE", `notice:${newId}`, `공지 등록 · ${title}`);
  // Members hear about new notices in 사이트 알림 (once per notice).
  notify({ kind: "NOTICE", title: "새 공지사항", body: title, href: `/support/notices/${newId}`, dedupeKey: `notice:${newId}` });
  return { status: "OK", id: newId };
}

export async function deleteNotice(admin: AdminActor, id: unknown): Promise<ContentResult> {
  assertMock();
  const store = noticeStore();
  const n = store.items.find((x) => x.id === id);
  if (!n) return { status: "NOT_FOUND" };
  store.items = store.items.filter((x) => x.id !== id);
  recordAudit(admin, "CONTENT_UPDATE", `notice:${n.id}`, `공지 삭제 · ${n.title}`);
  return { status: "OK", id: n.id };
}

export async function listFaqsAdmin(): Promise<FaqItem[] | null> {
  assertMock();
  return faqStore().items.map((f) => structuredClone(f));
}

export async function saveFaq(admin: AdminActor, input: unknown): Promise<ContentResult> {
  assertMock();
  const v = obj(input);
  const id = typeof v.id === "string" && v.id ? v.id : null;
  if (!id) {
    if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
    if (requests[v.requestId]) return { status: "OK", id: requests[v.requestId] };
  }
  const question = str(v.question);
  const answer = str(v.answer);
  const linkHref = str(v.linkHref);
  const linkLabel = str(v.linkLabel);
  if (!FAQ_CATEGORIES.some((c) => c.key === v.category)) return { status: "INVALID", message: "분류를 골라 주세요." };
  if (!question || question.length > FAQ_LIMITS.question) return { status: "INVALID", message: `질문을 1~${FAQ_LIMITS.question}자로 입력해 주세요.` };
  if (answer.length > FAQ_LIMITS.answer) return { status: "INVALID", message: `답변은 ${FAQ_LIMITS.answer}자까지예요.` };
  // Links stay inside the site (no external or script URLs).
  if (linkHref && (!/^\/[A-Za-z0-9/_\-?=&.]*$/.test(linkHref) || linkHref.startsWith("//") || !linkLabel || linkLabel.length > FAQ_LIMITS.linkLabel)) {
    return { status: "INVALID", message: "링크는 사이트 안의 주소(/로 시작)와 20자 이하 이름으로 입력해 주세요." };
  }
  if (forbidden(question, answer, linkLabel)) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  const next: Omit<FaqItem, "id"> = { category: v.category as FaqItem["category"], question, answer: answer || null, ...(linkHref ? { link: { href: linkHref, label: linkLabel } } : {}) };
  const items = faqStore().items;
  if (id) {
    const i = items.findIndex((f) => f.id === id);
    if (i < 0) return { status: "NOT_FOUND" };
    items[i] = { id, ...next };
    recordAudit(admin, "CONTENT_UPDATE", `faq:${id}`, `FAQ 수정 · ${question}`);
    return { status: "OK", id };
  }
  const newId = `faq-${Date.now().toString(36)}`;
  items.push({ id: newId, ...next });
  requests[v.requestId as string] = newId;
  recordAudit(admin, "CONTENT_UPDATE", `faq:${newId}`, `FAQ 등록 · ${question}`);
  return { status: "OK", id: newId };
}

export async function deleteFaq(admin: AdminActor, id: unknown): Promise<ContentResult> {
  assertMock();
  const store = faqStore();
  const f = store.items.find((x) => x.id === id);
  if (!f) return { status: "NOT_FOUND" };
  store.items = store.items.filter((x) => x.id !== id);
  recordAudit(admin, "CONTENT_UPDATE", `faq:${f.id}`, `FAQ 삭제 · ${f.question}`);
  return { status: "OK", id: f.id };
}
