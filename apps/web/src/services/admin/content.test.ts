import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** The operator the admin API acts for (the route layer authorises the admin app first). */
const OP = { userId: "adm-test", nickname: "테스트 운영자" };

/** 콘텐츠 관리: the 고객센터 reads what operators save; creates are deduped, changes audited. */
async function load() {
  const content = await import("./content");
  const { getNotices, getNotice } = await import("@/services/support/notices");
  const { getFaqs } = await import("@/services/support/faq");
  const { auditEntries } = await import("./auditCore");
  const { notificationStore } = await import("@/services/notifications/notificationCore");
  return { ...content, getNotices, getNotice, getFaqs, auditEntries, notificationStore };
}

const notice = { category: "UPDATE", important: true, title: "관리자 콘솔 공지", summary: "요약 문장", body: "첫 문단\n\n둘째 문단" };

describe("admin content", () => {
  beforeEach(() => {
    resetMockStores();
    signIn(["ADMIN"]);
  });

  it("publishes a notice once, shows it first on the site and notifies members", async () => {
    const m = await load();
    const res = await m.saveNotice(OP, { ...notice, requestId: key(1) });
    expect(await m.saveNotice(OP, { ...notice, requestId: key(1) })).toEqual(res);
    if (res.status !== "OK") throw new Error("not saved");
    expect((await m.getNotices())[0]).toMatchObject({ id: res.id, title: "관리자 콘솔 공지", body: ["첫 문단", "둘째 문단"], views: 0 });
    expect(m.notificationStore().items[0]).toMatchObject({ kind: "NOTICE", href: `/support/notices/${res.id}` });

    await m.saveNotice(OP, { ...notice, id: res.id, title: "수정된 제목", important: false });
    expect((await m.getNotice(res.id))!.title).toBe("수정된 제목");
    await m.deleteNotice(OP, res.id);
    expect(await m.getNotice(res.id)).toBeNull();
    expect(m.auditEntries().map((e) => e.reason?.split(" · ")[0])).toEqual(["공지 삭제", "공지 수정", "공지 등록"]);
  });

  it("validates notices and FAQs, keeps FAQ links inside the site", async () => {
    const m = await load();
    expect((await m.saveNotice(OP, { ...notice, title: "", requestId: key(2) })).status).toBe("INVALID");
    expect((await m.saveNotice(OP, { ...notice, category: "NOPE", requestId: key(3) })).status).toBe("INVALID");
    expect((await m.saveNotice(OP, { ...notice, category: "constructor", requestId: key(3) })).status).toBe("INVALID");
    const faq = { category: "DONATION", question: "새 질문인가요?", answer: "", linkHref: "", linkLabel: "" };
    expect((await m.saveFaq(OP, { ...faq, linkHref: "https://evil.example", linkLabel: "x", requestId: key(4) })).status).toBe("INVALID");
    expect((await m.saveFaq(OP, { ...faq, linkHref: "//evil.example", linkLabel: "x", requestId: key(5) })).status).toBe("INVALID");
    const ok = await m.saveFaq(OP, { ...faq, linkHref: "/wallet", linkLabel: "지갑", requestId: key(6) });
    expect(ok.status).toBe("OK");
    const found = (await m.getFaqs({ query: "새 질문" }))[0];
    expect(found).toMatchObject({ answer: null, link: { href: "/wallet", label: "지갑" } });
    await m.deleteFaq(OP, found.id);
    expect(await m.getFaqs({ query: "새 질문" })).toHaveLength(0);
  });

  it("logs an edit once when the same save arrives again (retry, double click)", async () => {
    const m = await load();
    const created = await m.saveNotice(OP, { ...notice, requestId: key(7) });
    if (created.status !== "OK") throw new Error("not saved");
    const edit = { ...notice, id: created.id, title: "수정된 제목" };
    expect(await m.saveNotice(OP, edit)).toEqual({ status: "OK", id: created.id });
    expect(await m.saveNotice(OP, edit)).toEqual({ status: "OK", id: created.id });

    const faq = { category: "DONATION", question: "재시도 질문인가요?", answer: "답변", linkHref: "/wallet", linkLabel: "지갑", requestId: key(8) };
    const f = await m.saveFaq(OP, faq);
    if (f.status !== "OK") throw new Error("not saved");
    const faqEdit = { ...faq, id: f.id, answer: "고친 답변" };
    expect(await m.saveFaq(OP, faqEdit)).toEqual({ status: "OK", id: f.id });
    expect(await m.saveFaq(OP, faqEdit)).toEqual({ status: "OK", id: f.id });
    expect(m.auditEntries().map((e) => e.reason?.split(" · ")[0])).toEqual(["FAQ 수정", "FAQ 등록", "공지 수정", "공지 등록"]);

    // A real change after that is logged again.
    await m.saveFaq(OP, { ...faqEdit, linkHref: "", linkLabel: "" });
    expect((await m.getFaqs({ query: "재시도 질문" }))[0].link).toBeUndefined();
    expect(m.auditEntries()).toHaveLength(5);
  });

  it("answers a reused create id with CONFLICT unless it is the same draft of the same kind", async () => {
    const m = await load();
    const res = await m.saveNotice(OP, { ...notice, requestId: key(1) });
    expect(res.status).toBe("OK");
    // After a timeout the operator fixes the title and saves again: not the earlier OK for a draft that was not saved.
    expect(await m.saveNotice(OP, { ...notice, title: "고친 제목", requestId: key(1) })).toEqual({ status: "CONFLICT" });
    expect((await m.getNotices()).some((n) => n.title === "고친 제목")).toBe(false);
    // A FAQ never borrows a notice's request id.
    const faq = { category: "DONATION", question: "다른 종류인가요?", answer: "", linkHref: "", linkLabel: "" };
    expect(await m.saveFaq(OP, { ...faq, requestId: key(1) })).toEqual({ status: "CONFLICT" });
    expect(await m.getFaqs({ query: "다른 종류" })).toHaveLength(0);
    // The same draft again (key order does not matter) is the retry it looks like.
    const { title, ...rest } = notice;
    expect(await m.saveNotice(OP, { requestId: key(1), ...rest, title })).toEqual(res);
    expect((await m.getNotices()).filter((n) => n.title === notice.title)).toHaveLength(1);
  });
});
