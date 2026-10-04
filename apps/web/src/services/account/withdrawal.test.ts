import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

/**
 * 회원 탈퇴 (2026-10-04 결정: 남은 FN 소멸 동의 후 바로 탈퇴): both consents are checked on the server, exactly
 * the balance the member saw is forfeited, the account can no longer sign in, and the admin directory keeps
 * the record. A creator with earnings waiting for settlement is blocked (their handling is TBD).
 */
async function load() {
  const withdrawal = await import("./withdrawal");
  const core = await import("./withdrawalCore");
  const { mockAccount } = await import("./mockStore");
  const { mockSettlement } = await import("@/services/creator/mockSettlementStore");
  const { login } = await import("@/services/auth/login");
  const members = await import("@/services/admin/members");
  const { SAMPLE_MEMBER_ID } = await import("@/services/admin/memberCore");
  const session = await import("@/lib/session");
  return { ...withdrawal, ...core, ...members, account: mockAccount, settlement: mockSettlement, login, SAMPLE_MEMBER_ID, session };
}

const OP = { userId: "admin-1", nickname: "운영자1" };

describe("회원 탈퇴", () => {
  beforeEach(() => {
    resetMockStores();
    signIn(["SUPPORTER"]);
  });

  it("needs both consents for the balance the member saw, then forfeits it and ends the account", async () => {
    const m = await load();
    const info = (await m.getWithdrawalInfo())!;
    expect(info).toMatchObject({ fnBalance: 5_000, creator: false, unsettledFn: 0, blocked: false });

    const base = { requestId: key(1), confirmed: true, forfeitAgreed: true, fnBalance: 5_000 };
    expect(await m.withdrawAccount({ ...base, requestId: "short" })).toMatchObject({ status: "INVALID" });
    expect(await m.withdrawAccount({ ...base, confirmed: false })).toEqual({ status: "INVALID", message: "탈퇴 안내를 확인하고 동의해 주세요." });
    expect(await m.withdrawAccount({ ...base, forfeitAgreed: false })).toEqual({ status: "INVALID", message: "남은 FN 소멸에 동의해 주세요." });
    // A charge landed after the page was shown: the consent was for another amount.
    expect(await m.withdrawAccount({ ...base, fnBalance: 3_000 })).toMatchObject({ status: "INVALID" });
    expect(m.isWithdrawn()).toBe(false);

    expect(await m.withdrawAccount(base)).toEqual({ status: "WITHDRAWN" });
    expect(m.withdrawalOf()).toMatchObject({ requestId: key(1), forfeitedFn: 5_000 });
    expect(m.account.fnBalance).toBe(0);
    expect(Object.values(m.account.linkedLoginProviders).every((p) => p === null)).toBe(true);
    expect(m.account.connectedPlatforms.every((p) => p.handle === null)).toBe(true);
    expect(m.session.revokeSession).toHaveBeenCalled();

    // The same request again (lost response) gets the same answer, even signed out; another one does not.
    signIn(null);
    expect(await m.withdrawAccount(base)).toEqual({ status: "WITHDRAWN" });
    expect(await m.withdrawAccount({ ...base, requestId: key(2) })).toEqual({ status: "UNAUTHORIZED" });
    expect(m.withdrawalOf()!.forfeitedFn).toBe(5_000);

    // The account no longer exists for sign-in.
    expect(await m.login({ identifier: "hongGD123", password: "password", keepSignedIn: false })).toEqual({ status: "UNKNOWN_ID" });
  });

  it("does not ask for the forfeit consent without a balance", async () => {
    const m = await load();
    m.account.fnBalance = 0;
    expect(await m.withdrawAccount({ requestId: key(1), confirmed: true, forfeitAgreed: false, fnBalance: 0 })).toEqual({ status: "WITHDRAWN" });
    expect(m.withdrawalOf()!.forfeitedFn).toBe(0);
  });

  it("blocks a creator with earnings waiting for settlement", async () => {
    signIn(["SUPPORTER", "CREATOR"]);
    const m = await load();
    expect(await m.getWithdrawalInfo()).toMatchObject({ creator: true, unsettledFn: 127_500, blocked: true });
    expect(await m.withdrawAccount({ requestId: key(1), confirmed: true, forfeitAgreed: true, fnBalance: 5_000 })).toEqual({ status: "BLOCKED", unsettledFn: 127_500 });
    expect(m.isWithdrawn()).toBe(false);

    // 정산 신청 중 counts too; with nothing left to settle the creator can withdraw.
    m.settlement.availableFn = 0;
    m.settlement.requests.push({ ...m.settlement.requests[0], id: "st-pending", status: "PENDING", amountFn: 20_000 });
    expect(await m.getWithdrawalInfo()).toMatchObject({ unsettledFn: 20_000, blocked: true });
    m.settlement.requests.pop();
    expect(await m.withdrawAccount({ requestId: key(2), confirmed: true, forfeitAgreed: true, fnBalance: 5_000 })).toEqual({ status: "WITHDRAWN" });
  });

  it("needs a signed-in member", async () => {
    signIn(null);
    const m = await load();
    expect(await m.getWithdrawalInfo()).toBeNull();
    expect(await m.withdrawAccount({ requestId: key(1), confirmed: true, forfeitAgreed: true, fnBalance: 5_000 })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("keeps the withdrawn member in the admin directory as 탈퇴", async () => {
    const m = await load();
    await m.withdrawAccount({ requestId: key(1), confirmed: true, forfeitAgreed: true, fnBalance: 5_000 });
    const detail = (await m.getMemberDetail(m.SAMPLE_MEMBER_ID))!;
    expect(detail.member).toMatchObject({ status: "WITHDRAWN", suspension: null, withdrawal: { forfeitedFn: 5_000 } });
    const page = (await m.listMembers({ status: "WITHDRAWN" }))!;
    expect(page.items.map((i) => i.id)).toEqual([m.SAMPLE_MEMBER_ID]);
    expect(await m.suspendMember(OP, { id: m.SAMPLE_MEMBER_ID, days: 7, reason: "운영 정책 위반 (테스트)", requestId: key(3) })).toEqual({
      status: "INVALID",
      message: "탈퇴한 회원이에요."
    });
  });
});
