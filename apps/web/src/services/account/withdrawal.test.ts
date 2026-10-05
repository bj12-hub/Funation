import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

/**
 * 회원 탈퇴 (2026-10-04 결정: 남은 FN 소멸 동의 후 바로 탈퇴; 2026-10-05: 크리에이터 정산 대기 수익도 소멸 동의,
 * 비밀번호 재입력, 바로 재가입 가능): every consent and the password are checked on the server, exactly the amounts
 * the member saw are forfeited, the account can no longer sign in, the admin directory keeps the record, and a new
 * sign-up starts a fresh account.
 */
async function load() {
  const withdrawal = await import("./withdrawal");
  const core = await import("./withdrawalCore");
  const store = await import("./mockStore");
  const { mockSettlement } = await import("@/services/creator/mockSettlementStore");
  const { login } = await import("@/services/auth/login");
  const { signup } = await import("@/services/auth/signup");
  const { getWalletOverview } = await import("@/services/wallet/walletHistory");
  const members = await import("@/services/admin/members");
  const { getSettlementReview } = await import("@/services/admin/settlements");
  const { SAMPLE_MEMBER_ID } = await import("@/services/admin/memberCore");
  const session = await import("@/lib/session");
  return {
    ...withdrawal,
    ...core,
    ...members,
    account: store.mockAccount,
    credentials: store.mockCredentials,
    sessionState: store.mockSessionState,
    settlement: mockSettlement,
    login,
    signup,
    getWalletOverview,
    getSettlementReview,
    SAMPLE_MEMBER_ID,
    session
  };
}

const OP = { userId: "admin-1", nickname: "운영자1" };
const PASSWORD = "password"; // the mock account's initial password (services/account/mockStore.ts)
const supporter = (n = 1) => ({ requestId: key(n), confirmed: true, forfeitAgreed: true, fnBalance: 5_000, unsettledFn: 0, password: PASSWORD });

describe("회원 탈퇴", () => {
  beforeEach(() => {
    resetMockStores();
    signIn(["SUPPORTER"]);
  });

  it("needs every consent for the amounts the member saw and the password, then forfeits and ends the account", async () => {
    const m = await load();
    expect(await m.getWithdrawalInfo()).toEqual({ nickname: "홍길동", fnBalance: 5_000, creator: false, unsettledFn: 0 });

    const base = supporter();
    expect(await m.withdrawAccount({ ...base, requestId: "short" })).toMatchObject({ status: "INVALID" });
    expect(await m.withdrawAccount({ ...base, confirmed: false })).toEqual({ status: "INVALID", message: "탈퇴 안내를 확인하고 동의해 주세요." });
    expect(await m.withdrawAccount({ ...base, forfeitAgreed: false })).toEqual({ status: "INVALID", message: "남은 FN 소멸에 동의해 주세요." });
    // A charge landed after the page was shown: the consent was for another amount.
    expect(await m.withdrawAccount({ ...base, fnBalance: 3_000 })).toMatchObject({ status: "INVALID" });
    expect(await m.withdrawAccount({ ...base, password: "wrong-one" })).toEqual({ status: "WRONG_PASSWORD" });
    expect(await m.withdrawAccount({ ...base, password: undefined })).toEqual({ status: "WRONG_PASSWORD" });
    expect(m.isWithdrawn()).toBe(false);

    expect(await m.withdrawAccount(base)).toEqual({ status: "WITHDRAWN" });
    expect(m.withdrawalOf()).toMatchObject({ requestId: key(1), forfeitedFn: 5_000, forfeitedEarningsFn: 0, nickname: "홍길동" });
    expect(m.account.fnBalance).toBe(0);
    expect(Object.values(m.account.linkedLoginProviders).every((p) => p === null)).toBe(true);
    expect(m.account.connectedPlatforms.every((p) => p.handle === null)).toBe(true);
    expect(m.session.revokeSession).toHaveBeenCalled();

    // The same request again (lost response) gets the same answer, even signed out; another one does not.
    signIn(null);
    expect(await m.withdrawAccount(base)).toEqual({ status: "WITHDRAWN" });
    expect(await m.withdrawAccount(supporter(2))).toEqual({ status: "UNAUTHORIZED" });

    // The account no longer exists for sign-in.
    expect(await m.login({ identifier: "hongGD123", password: PASSWORD, keepSignedIn: false })).toEqual({ status: "UNKNOWN_ID" });
  });

  it("does not ask for the FN consent without a balance", async () => {
    const m = await load();
    m.account.fnBalance = 0;
    expect(await m.withdrawAccount({ ...supporter(), forfeitAgreed: false, fnBalance: 0 })).toEqual({ status: "WITHDRAWN" });
    expect(m.withdrawalOf()!.forfeitedFn).toBe(0);
  });

  it("lets a creator forfeit earnings waiting for settlement with its own consent", async () => {
    signIn(["SUPPORTER", "CREATOR"]);
    const m = await load();
    m.settlement.requests.push({ ...m.settlement.requests[0], id: "st-pending", status: "PENDING", amountFn: 20_000, review: undefined });
    expect(await m.getWithdrawalInfo()).toMatchObject({ creator: true, unsettledFn: 147_500 });

    const base = { ...supporter(), unsettledFn: 147_500, earningsForfeitAgreed: true };
    expect(await m.withdrawAccount({ ...base, earningsForfeitAgreed: false })).toEqual({ status: "INVALID", message: "정산 대기 수익 소멸에 동의해 주세요." });
    expect(await m.withdrawAccount({ ...base, unsettledFn: 127_500 })).toEqual({ status: "INVALID", message: "정산 대기 수익이 바뀌었어요. 금액을 다시 확인해 주세요." });
    expect(m.isWithdrawn()).toBe(false);

    expect(await m.withdrawAccount(base)).toEqual({ status: "WITHDRAWN" });
    expect(m.withdrawalOf()).toMatchObject({ forfeitedFn: 5_000, forfeitedEarningsFn: 147_500 });
    expect(m.settlement.availableFn).toBe(0);
    // The waiting request ends as 탈퇴 소멸 (not 반려) and leaves the review queue; decided ones stay as they were.
    const forfeited = m.settlement.requests.find((r) => r.id === "st-pending")!;
    expect(forfeited).toMatchObject({ status: "FORFEITED", payoutDate: null, review: { by: "회원 탈퇴" } });
    const review = (await m.getSettlementReview())!;
    expect(review.counts).toMatchObject({ PENDING: 0, FORFEITED: 1, APPROVED: 5, REJECTED: 1 });
  });

  it("needs a signed-in member", async () => {
    signIn(null);
    const m = await load();
    expect(await m.getWithdrawalInfo()).toBeNull();
    expect(await m.withdrawAccount(supporter())).toEqual({ status: "UNAUTHORIZED" });
  });

  it("keeps the withdrawn member in the admin directory as 탈퇴", async () => {
    const m = await load();
    await m.withdrawAccount(supporter());
    const detail = (await m.getMemberDetail(m.SAMPLE_MEMBER_ID))!;
    expect(detail.member).toMatchObject({ status: "WITHDRAWN", suspension: null, withdrawal: { forfeitedFn: 5_000, forfeitedEarningsFn: 0 } });
    expect((await m.listMembers({ status: "WITHDRAWN" }))!.items.map((i) => i.id)).toEqual([m.SAMPLE_MEMBER_ID]);
    expect(await m.suspendMember(OP, { id: m.SAMPLE_MEMBER_ID, days: 7, reason: "운영 정책 위반 (테스트)", requestId: key(3) })).toEqual({
      status: "INVALID",
      message: "탈퇴한 회원이에요."
    });
  });

  it("lets the same person sign up again right away as a new account", async () => {
    const m = await load();
    await m.withdrawAccount(supporter());
    const signupRequest = {
      email: "again@funation.kr",
      password: "newpass12!",
      nickname: "다시왔어요",
      phoneVerificationToken: "mock-010-1234-5678",
      agreements: { youth: true, service: true, privacy: true, marketing: true }
    } as const;
    expect(await m.signup(signupRequest)).toEqual({ status: "CREATED" });
    expect(m.isWithdrawn()).toBe(false);
    expect(m.account).toMatchObject({ nickname: "다시왔어요", fnBalance: 0, marketingConsent: true, avatarUrl: null });
    expect(m.sessionState.roles).toEqual(["SUPPORTER"]);

    // Signs in with the new password only; nothing of the withdrawn account comes back.
    expect(await m.login({ identifier: "again@funation.kr", password: PASSWORD, keepSignedIn: false })).toEqual({ status: "WRONG_PASSWORD" });
    expect(await m.login({ identifier: "again@funation.kr", password: "newpass12!", keepSignedIn: false })).toEqual({ status: "SUCCESS" });
    signIn(["SUPPORTER"]);
    const wallet = (await m.getWalletOverview({ period: "all" }))!;
    expect(wallet).toMatchObject({ available: 0, entries: [] });

    // The withdrawn account stays in the admin directory; the slot is an active member again.
    const withdrawn = (await m.listMembers({ status: "WITHDRAWN" }))!.items;
    expect(withdrawn.map((i) => [i.id, i.nickname, i.withdrawal?.forfeitedFn])).toEqual([[`${m.SAMPLE_MEMBER_ID}-w1`, "홍길동", 5_000]]);
    expect((await m.getMemberDetail(m.SAMPLE_MEMBER_ID))!.member).toMatchObject({ status: "ACTIVE", nickname: "다시왔어요", withdrawal: null });
  });

  it("does not touch accounts that never withdrew when someone signs up", async () => {
    const m = await load();
    expect(
      await m.signup({ email: "new@funation.kr", password: "abcd123!", nickname: "새회원", phoneVerificationToken: "t", agreements: { youth: true, service: true, privacy: true, marketing: false } })
    ).toEqual({ status: "CREATED" });
    expect(m.account.nickname).toBe("홍길동");
    expect(m.account.fnBalance).toBe(5_000);
  });
});
