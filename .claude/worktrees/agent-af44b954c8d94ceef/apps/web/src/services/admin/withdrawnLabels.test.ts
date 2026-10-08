import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, rejoinWithPhone, resetMockStores, signIn, signInAs } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

const OP = { userId: "adm-test", nickname: "테스트 운영자" };

/**
 * 2026-10-08 결정: every console screen shows a withdrawn member with the original nickname and a 탈퇴 mark — before a
 * 재가입 (the slot's own account while withdrawn) and after it (`…-wN`). The site keeps "탈퇴한 회원" for community content.
 */
async function load() {
  const payments = await import("./payments");
  const { getSettlementReview } = await import("./settlements");
  const { listReports } = await import("./reports");
  const { listAuditLog } = await import("./admin");
  const { suspendMember, restoreMember } = await import("./members");
  const { SAMPLE_MEMBER_ID, withdrawnMemberId } = await import("./memberCore");
  const { mockSettlement } = await import("@/services/creator/mockSettlementStore");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  const { accountSince } = await import("@/services/account/withdrawalCore");
  const { recordWithdrawal } = await import("@/services/account/withdrawalRecord");
  const { requestChargeRefund } = await import("@/services/wallet/refund");
  const { listChargeRecords } = await import("@/services/wallet/walletHistory");
  const community = await import("@/services/community/community");
  const moderation = await import("@/services/moderation/moderation");
  return {
    ...payments,
    getSettlementReview,
    listReports,
    listAuditLog,
    suspendMember,
    restoreMember,
    SAMPLE_MEMBER_ID,
    withdrawnMemberId,
    mockSettlement,
    mockCreator,
    recordWithdrawal,
    accountSince,
    requestChargeRefund,
    listChargeRecords,
    community,
    moderation
  };
}
type M = Awaited<ReturnType<typeof load>>;

/** The sample member files a refund, writes a post someone reports, reports a post, and gets suspended and restored. */
async function activity(m: M) {
  signInAs(m.SAMPLE_MEMBER_ID);
  const charge = m.listChargeRecords().find((c) => c.status === "COMPLETED")!;
  expect((await m.requestChargeRefund({ chargeId: charge.id, reason: "실수" })).status).toBe("REQUESTED");
  const post = await m.community.createPost({ category: "FREE", title: "탈퇴 전 글", body: "내용", requestId: key(1) });
  const postId = post.status === "SAVED" ? post.id : "";
  expect(await m.moderation.submitReport({ target: { type: "POST", id: "p-2" }, reason: "SPAM" })).toEqual({ status: "REPORTED" });
  signInAs("u-other");
  expect(await m.moderation.submitReport({ target: { type: "POST", id: postId }, reason: "SPAM" })).toEqual({ status: "REPORTED" });
  signIn(["ADMIN"]);
  await m.suspendMember(OP, { id: m.SAMPLE_MEMBER_ID, days: 1, reason: "탈퇴 전 정지 사유", requestId: key(2) });
  await m.restoreMember(OP, { id: m.SAMPLE_MEMBER_ID, reason: "탈퇴 전 정지 해제" });
  return { postId };
}

const withdraw = (m: M) => {
  m.recordWithdrawal({ at: new Date().toISOString(), requestId: "w-test", forfeitedFn: 0, forfeitedEarningsFn: 0 });
};

/** What each console list says about the member's records: `name withdrawn` (ids where the console links them). */
async function labels(m: M, postId: string) {
  const view = (await m.getPaymentsView())!;
  const reports = (await m.listReports()).rows;
  const audit = (await m.listAuditLog({ show: 100 }))!.items.filter((e) => e.targetMember);
  return {
    refund: view.refunds.map((r) => `${r.memberId} ${r.memberName} ${r.memberWithdrawn}`),
    charges: [...new Set(view.charges.map((c) => `${c.memberId} ${c.memberName} ${c.memberWithdrawn}`))],
    donations: [...new Set((await m.getDonationsView())!.rows.map((d) => `${d.memberId} ${d.memberName} ${d.memberWithdrawn}`))],
    settlements: [...new Set((await m.getSettlementReview())!.rows.map((r) => `${r.creatorName} ${r.creatorWithdrawn}`))],
    reportedByMember: reports.filter((r) => r.target.id === "p-2").map((r) => `${r.reporterName} ${r.reporterWithdrawn}`),
    reportedPost: reports.filter((r) => r.target.id === postId).map((r) => `${r.authorName} ${r.authorWithdrawn}`),
    audit: audit.map((e) => `${e.targetMember!.id} ${e.targetMember!.name} ${e.targetMember!.withdrawn}`)
  };
}

describe("withdrawn members in the console (2026-10-08 결정)", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T03:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("shows an active member by nickname without the mark", async () => {
    const m = await load();
    const { postId } = await activity(m);
    const l = await labels(m, postId);
    const me = `${m.SAMPLE_MEMBER_ID} 홍길동 false`;
    expect(l).toMatchObject({ refund: [me], charges: [me], donations: [me], settlements: [`${m.mockCreator.channelName} false`], reportedByMember: ["홍길동 false"], reportedPost: ["홍길동 false"] });
    expect(l.audit).toEqual([me, me]);
  });

  it("marks the member 탈퇴 under the original nickname once withdrawn, before a 재가입", async () => {
    const m = await load();
    const { postId } = await activity(m);
    withdraw(m);
    const gone = `${m.SAMPLE_MEMBER_ID} 홍길동 true`;
    expect(await labels(m, postId)).toEqual({
      refund: [gone],
      charges: [gone],
      donations: [gone],
      settlements: ["홍길동 true"],
      reportedByMember: ["홍길동 true"],
      reportedPost: ["홍길동 true"],
      audit: [gone, gone]
    });
  });

  it("keeps the mark under `…-w1` after a 재가입, and shows the new account's own records without it", async () => {
    const m = await load();
    const { postId } = await activity(m);
    await rejoinWithPhone("010-0000-0000", new Date("2026-10-02T03:00:00Z"));
    vi.setSystemTime(new Date("2026-10-03T03:00:00Z"));
    const old = `${m.withdrawnMemberId(1)} 홍길동 true`;
    expect(await labels(m, postId)).toEqual({
      refund: [old],
      charges: [old],
      donations: [old],
      settlements: ["홍길동 true"],
      reportedByMember: ["홍길동 true"],
      reportedPost: ["홍길동 true"],
      audit: [old, old]
    });

    // The new account's own settlement request and audit entry carry its own name, unmarked.
    m.mockSettlement.requests.unshift({ ...m.mockSettlement.pastRequests![0], id: "st-new", status: "PENDING", review: undefined, account: m.accountSince() });
    await m.suspendMember(OP, { id: m.SAMPLE_MEMBER_ID, days: 1, reason: "새 계정 정지 사유", requestId: key(3) });
    const review = (await m.getSettlementReview())!.rows;
    expect(review.find((r) => r.id === "st-new")).toMatchObject({ creatorName: m.mockCreator.channelName, creatorWithdrawn: false });
    expect((await m.listAuditLog({ show: 100 }))!.items[0].targetMember).toEqual({ id: m.SAMPLE_MEMBER_ID, name: "다시왔어요", withdrawn: false });
  });

  it("keeps the site's 탈퇴한 회원 for community content", async () => {
    const m = await load();
    const { postId } = await activity(m);
    withdraw(m);
    expect(await m.community.getPost(postId)).toMatchObject({ authorName: "탈퇴한 회원" });
  });
});
