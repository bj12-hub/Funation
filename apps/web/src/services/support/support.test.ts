import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn, signInAs } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 고객센터 (funnation tabs): FAQ by category/search, notices order, 1:1 문의. */
describe("support", () => {
  beforeEach(() => resetMockStores());

  it("filters the FAQ by category and search, and lists important notices first", async () => {
    const { getFaqs } = await import("./faq");
    const { getNotices, getNotice } = await import("./notices");
    const donation = await getFaqs({ category: "DONATION" });
    expect(donation.length).toBeGreaterThan(0);
    expect(donation.every((f) => f.category === "DONATION")).toBe(true);
    const search = await getFaqs({ query: "비밀번호" });
    expect(search.every((f) => f.question.includes("비밀번호") || f.answer?.includes("비밀번호"))).toBe(true);
    const notices = await getNotices();
    expect(notices[0].important).toBe(true);
    expect(await getNotice("nope")).toBeNull();
  });

  it("records a member's inquiry once per request and validates it", async () => {
    const { submitInquiry, listMyInquiries } = await import("./inquiry");
    const input = { requestId: key(1), category: "DONATION", title: "후원이 안 보여요", body: "어제 보낸 후원이 내역에 보이지 않아요." };
    const first = await submitInquiry(input);
    expect(first.status).toBe("SUBMITTED");
    expect(await submitInquiry(input)).toEqual(first);
    expect((await listMyInquiries())!.map((q) => [q.title, q.status])).toEqual([["후원이 안 보여요", "RECEIVED"]]);
    expect((await submitInquiry({ ...input, requestId: key(2), body: "짧음" })).status).toBe("INVALID");
    expect((await submitInquiry({ ...input, requestId: key(3), category: "NOPE" })).status).toBe("INVALID");
    signIn(null);
    expect(await submitInquiry({ ...input, requestId: key(4) })).toEqual({ status: "UNAUTHORIZED" });
    expect(await listMyInquiries()).toBeNull();
  });

  it("starts a 재가입 account without the withdrawn account's inquiries", async () => {
    const { submitInquiry, listMyInquiries } = await import("./inquiry");
    const { withdrawalStore } = await import("@/services/account/withdrawalCore");
    const { startNewAccount } = await import("@/services/account/rejoin");
    const input = { requestId: key(1), category: "ACCOUNT", title: "탈퇴 전 문의", body: "탈퇴하기 전에 남긴 개인적인 문의 내용이에요." };
    const old = await submitInquiry(input);
    expect((await listMyInquiries())!.map((q) => q.title)).toEqual(["탈퇴 전 문의"]);

    // The mock's 재가입 reuses the slot (and its user id) for a new account.
    withdrawalStore().withdrawal = { at: new Date().toISOString(), requestId: "w-test", forfeitedFn: 0, forfeitedEarningsFn: 0, nickname: "홍길동", funationId: "hongGD123" };
    expect(startNewAccount({ nickname: "다시왔어요", password: "newpass12!", marketing: false, phone: "010-0000-0000" })).toBe(true);
    expect(await listMyInquiries()).toEqual([]);
    // Its own request ids are its own: the same id is a new inquiry, not the withdrawn account's.
    const fresh = await submitInquiry({ ...input, title: "새 계정 문의" });
    expect(fresh.status).toBe("SUBMITTED");
    expect(fresh).not.toEqual(old);
    expect((await listMyInquiries())!.map((q) => q.title)).toEqual(["새 계정 문의"]);
  });

  it("never answers another member's request id with their inquiry", async () => {
    const { submitInquiry, listMyInquiries } = await import("./inquiry");
    const input = { requestId: key(1), category: "DONATION", title: "후원이 안 보여요", body: "어제 보낸 후원이 내역에 보이지 않아요." };
    const mine = await submitInquiry(input);
    signInAs("u-other");
    const theirs = await submitInquiry({ ...input, title: "다른 문의" });
    expect(theirs.status).toBe("SUBMITTED");
    expect(theirs).not.toEqual(mine);
    expect((await listMyInquiries())!.map((q) => q.title)).toEqual(["다른 문의"]);
  });
});
