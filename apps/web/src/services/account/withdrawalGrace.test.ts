import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, phoneToken, resetMockStores, settleSampleCharges, settleSamplePlatformDonations } from "@/test/mockEnv";

// The real session (cookie → sample member), so a waiting 탈퇴 신청 is checked where every request reads it.
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name)
  })
}));
vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
// The sample password is old, so a successful sign-in also redirects to the change prompt (a no-op here).
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

/**
 * 회원탈퇴 유예 (탈퇴 철회 30일) — 2026-11-01 사용자 결정 (FLEXTV 조건 기본안): pressing 탈퇴 stores a request and signs
 * the member out; for 30 days the account and its data stay as they are but cannot be used (기본값), and signing in with
 * the password can cancel it; exactly 30 days after the request the 탈퇴 takes effect with the amounts of that moment.
 */
const T0 = new Date("2026-11-02T03:00:00.000Z");
const EFFECTIVE_AT = "2026-12-02T03:00:00.000Z"; // T0 + 30 days, exactly
const PASSWORD = "password"; // the mock account's initial password (services/account/mockStore.ts)
const OP = { userId: "admin-1", nickname: "운영자1" };
const ID = "hongGD123";

async function load() {
  const withdrawal = await import("./withdrawal");
  const core = await import("./withdrawalCore");
  const { applyDueWithdrawal } = await import("./withdrawalApply");
  const { purgeExpired } = await import("./retentionPurge");
  const { creatorAccessOpen, overlayKeyOpen } = await import("./creatorAccess");
  const store = await import("./mockStore");
  const session = await import("@/lib/session");
  const { login } = await import("@/services/auth/login");
  const { resolveAccount } = await import("@/services/auth/loginLockCore");
  const signup = await import("@/services/auth/signup");
  const { mockSettlement } = await import("@/services/creator/mockSettlementStore");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  const { bankSmsStore } = await import("@/services/bankSms/bankSmsCore");
  const { managerLinks } = await import("@/services/broadcast/chatCore");
  const { createManagerLink, getManagerChat } = await import("@/services/broadcast/managerChat");
  const { getOverlayAlert } = await import("@/services/creator/alertRemote");
  const { decideSettlement } = await import("@/services/admin/settlements");
  const members = await import("@/services/admin/members");
  const { SAMPLE_MEMBER_ID } = await import("@/services/admin/memberCore");
  return {
    ...withdrawal,
    ...core,
    ...signup,
    applyDueWithdrawal,
    purgeExpired,
    creatorAccessOpen,
    overlayKeyOpen,
    account: store.mockAccount,
    currentPersonKey: store.currentPersonKey,
    session,
    login,
    resolveAccount,
    settlement: mockSettlement,
    mockCreator,
    bankSmsStore,
    managerLinks,
    createManagerLink,
    getManagerChat,
    getOverlayAlert,
    decideSettlement,
    ...members,
    SAMPLE_MEMBER_ID
  };
}
type M = Awaited<ReturnType<typeof load>>;

const signIn = (m: M) => m.session.startSession({ keepSignedIn: false });

/** A 심사 대기 정산 request of the sample creator (a copy of the seed's first, with its 정산 정보). */
const pendingSettlement = (m: M, id: string, amountFn: number) =>
  m.settlement.requests.push({ ...m.settlement.requests[0], id, status: "PENDING", amountFn, review: undefined });

/** The signed-in sample creator asks to withdraw with the amounts the screen shows. */
async function requestWithdrawal(m: M, n = 1) {
  const info = (await m.getWithdrawalInfo())!;
  const input = { requestId: key(n), confirmed: true, forfeitAgreed: true, earningsForfeitAgreed: true, fnBalance: info.fnBalance, unsettledFn: info.unsettledFn, password: PASSWORD };
  return { input, info, result: await m.withdrawAccount(input) };
}

/** What a cancelled request must leave exactly as it was. */
const snapshot = (m: M) =>
  JSON.parse(
    JSON.stringify({
      account: m.account,
      settlement: { terms: m.settlement.terms, registration: m.settlement.registration, autoSettlement: m.settlement.autoSettlement, availableFn: m.settlement.availableFn, requests: m.settlement.requests },
      keys: { overlay: m.mockCreator.integrationKey, sms: m.bankSmsStore().key },
      managerLinks: m.managerLinks().map((l) => l.token)
    })
  );

describe("회원탈퇴 유예 (탈퇴 철회 30일)", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    resetMockStores();
    cookieJar.clear();
    // The sample PENDING 플랫폼 후원 and 처리중 충전 would hold the 탈퇴 (tested in withdrawal.test.ts), and so would the
    // studio's running sample quests (q1 · q2, 2026-10-08 결정): the signed-in sample creator ends them first.
    await settleSamplePlatformDonations();
    await settleSampleCharges();
    const { startSession } = await import("@/lib/session");
    await startSession({ keepSignedIn: false });
    const { decideReceivedQuest } = await import("@/services/creator/donationManagement");
    for (const id of ["q1", "q2"]) expect(await decideReceivedQuest({ id, outcome: "CANCELED" })).toMatchObject({ status: "OK" });
  });
  afterEach(() => vi.useRealTimers());

  it("takes a request: signed out at once, the account and its data kept as they are, unusable for the 30 days", async () => {
    const m = await load();
    expect(await m.createManagerLink({ requestId: key(50), name: "지민", permissions: ["HIDE"] })).toEqual({ status: "OK" });
    const token = m.managerLinks()[0].token;
    m.settlement.registration = { ...m.settlement.requests[0].registrationAtRequest! };
    const before = snapshot(m);
    // A 후원 that read the session before the request and debits after it (another tab).
    const holder = m.sessionAccount();
    expect(await m.getOverlayAlert(m.mockCreator.integrationKey)).not.toBe("FORBIDDEN");

    const { info, input, result } = await requestWithdrawal(m);
    expect(result).toEqual({ status: "REQUESTED", effectiveAt: EFFECTIVE_AT });
    expect(m.withdrawalStore().request).toEqual({
      requestId: key(1),
      requestedAt: T0.toISOString(),
      effectiveAt: EFFECTIVE_AT,
      consentedFn: 5_000,
      consentedEarningsFn: info.unsettledFn,
      creator: true
    });

    // Signed out, and no new session works while it waits (a login elsewhere sets the cookie again).
    expect(await m.session.getSession()).toBeNull();
    await signIn(m);
    expect(await m.session.getSession()).toBeNull();
    expect(holder.stillHere()).toBe(false);

    // Not withdrawn: nothing is forfeited, deleted or reissued.
    expect(m.isWithdrawn()).toBe(false);
    expect(m.isWithdrawalRequested()).toBe(true);
    expect(m.withdrawalOf()).toBeNull();
    expect(snapshot(m)).toEqual(before);
    expect(m.account.fnBalance).toBe(5_000);

    // Access that acts for the channel without a login is closed, as during a suspension (keys unchanged).
    expect(m.creatorAccessOpen()).toBe(false);
    expect(m.overlayKeyOpen(m.mockCreator.integrationKey)).toBe(false);
    expect(await m.getOverlayAlert(m.mockCreator.integrationKey)).toBe("FORBIDDEN");
    expect(await m.getManagerChat(token)).toBe("FORBIDDEN");

    // The same request again (lost response) gets the same answer; another one finds no account to act for.
    expect(await m.withdrawAccount(input)).toEqual({ status: "REQUESTED", effectiveAt: EFFECTIVE_AT });
    expect(await m.withdrawAccount({ ...input, requestId: key(2) })).toEqual({ status: "UNAUTHORIZED" });

    // The console shows the request next to the unchanged status.
    const detail = (await m.getMemberDetail(m.SAMPLE_MEMBER_ID))!.member;
    expect(detail).toMatchObject({ status: "ACTIVE", withdrawal: null, withdrawalRequest: { requestedAt: T0.toISOString(), effectiveAt: EFFECTIVE_AT }, fnBalance: 5_000 });
    const listed = (await m.listMembers({ status: "ACTIVE" }))!.items.find((i) => i.id === m.SAMPLE_MEMBER_ID);
    expect(listed?.withdrawalRequest).toEqual({ requestedAt: T0.toISOString(), effectiveAt: EFFECTIVE_AT });
    expect((await m.listMembers({ status: "WITHDRAWN" }))!.items).toEqual([]);
  });

  it("answers the right password with WITHDRAWAL_PENDING and no session; a wrong one still counts toward the lock", async () => {
    const m = await load();
    expect((await requestWithdrawal(m)).result.status).toBe("REQUESTED");
    expect(await m.login({ identifier: ID, password: PASSWORD, keepSignedIn: false })).toEqual({ status: "WITHDRAWAL_PENDING", effectiveAt: EFFECTIVE_AT });
    expect(await m.session.getSession()).toBeNull();

    // Wrong passwords count as always; the right one clears them (and still only offers the cancel).
    for (let i = 0; i < 4; i++) expect(await m.login({ identifier: ID, password: "wrong-pass1", keepSignedIn: false })).toEqual({ status: "WRONG_PASSWORD" });
    expect((await m.login({ identifier: ID, password: PASSWORD, keepSignedIn: false })).status).toBe("WITHDRAWAL_PENDING");
    for (let i = 0; i < 4; i++) expect((await m.login({ identifier: ID, password: "wrong-pass1", keepSignedIn: false })).status).toBe("WRONG_PASSWORD");
    expect(await m.login({ identifier: ID, password: "wrong-pass1", keepSignedIn: false })).toEqual({ status: "LOCKED" });
    // Locked: not even the cancel goes through, and the request stays.
    expect(await m.login({ identifier: ID, password: PASSWORD, keepSignedIn: false, cancelWithdrawal: true })).toEqual({ status: "LOCKED" });
    expect(m.isWithdrawalRequested()).toBe(true);

    // A password reset (phone) still works for the account, and lifts the lock; the new password cancels the 탈퇴.
    const { resetPassword } = await import("@/services/auth/passwordReset");
    expect(await resetPassword(await phoneToken("PASSWORD_RESET"), "newpass12!")).toEqual({ status: "RESET" });
    expect((await m.login({ identifier: ID, password: "newpass12!", keepSignedIn: false })).status).toBe("WITHDRAWAL_PENDING");
    expect(await m.login({ identifier: ID, password: "newpass12!", keepSignedIn: false, cancelWithdrawal: true })).toEqual({ status: "SUCCESS" });
    expect(m.isWithdrawalRequested()).toBe(false);
  });

  it("cancels at sign-in: the account comes back exactly as it was, signed in, and can ask again later", async () => {
    const m = await load();
    expect(await m.createManagerLink({ requestId: key(50), name: "지민", permissions: ["HIDE"] })).toEqual({ status: "OK" });
    const token = m.managerLinks()[0].token;
    m.settlement.registration = { ...m.settlement.requests[0].registrationAtRequest! };
    m.settlement.autoSettlement = true;
    const personKey = m.currentPersonKey();
    expect((await requestWithdrawal(m)).result.status).toBe("REQUESTED");
    const before = snapshot(m);

    vi.setSystemTime(new Date("2026-11-20T00:00:00.000Z")); // day 18
    // A wrong password does not cancel anything.
    expect(await m.login({ identifier: ID, password: "wrong-pass1", keepSignedIn: false, cancelWithdrawal: true })).toEqual({ status: "WRONG_PASSWORD" });
    expect(m.isWithdrawalRequested()).toBe(true);
    expect(await m.login({ identifier: ID, password: PASSWORD, keepSignedIn: true, cancelWithdrawal: true })).toEqual({ status: "SUCCESS" });

    expect(m.withdrawalStore().request).toBeNull();
    expect(m.isWithdrawalRequested()).toBe(false);
    expect(m.isWithdrawn()).toBe(false);
    expect(await m.session.getSession()).toMatchObject({ userId: m.SAMPLE_MEMBER_ID, roles: ["SUPPORTER", "CREATOR"] });
    // FN, links, the settlement registration and every key exactly as before; the access is open again.
    expect(snapshot(m)).toEqual(before);
    expect(m.currentPersonKey()).toBe(personKey);
    expect(m.creatorAccessOpen()).toBe(true);
    expect(await m.getOverlayAlert(m.mockCreator.integrationKey)).not.toBe("FORBIDDEN");
    expect(await m.getManagerChat(token)).not.toBe("FORBIDDEN");
    expect((await m.getMemberDetail(m.SAMPLE_MEMBER_ID))!.member).toMatchObject({ status: "ACTIVE", withdrawalRequest: null });

    // Nothing is due later: the old request is gone, so its date passes without a 탈퇴.
    vi.setSystemTime(new Date("2026-12-03T00:00:00.000Z"));
    expect(m.applyDueWithdrawal()).toBe(false);
    expect(m.isWithdrawn()).toBe(false);
    // A new request starts its own 30 days.
    expect((await requestWithdrawal(m, 3)).result).toEqual({ status: "REQUESTED", effectiveAt: "2027-01-02T00:00:00.000Z" });
  });

  it("removes the request but keeps a suspended member out (SUSPENDED)", async () => {
    const m = await load();
    expect((await requestWithdrawal(m)).result.status).toBe("REQUESTED");
    // An operator can still suspend the account during the 30 days; the console keeps showing both.
    expect(await m.suspendMember(OP, { id: m.SAMPLE_MEMBER_ID, days: 7, reason: "운영 정책 위반 (테스트)", requestId: key(60) })).toEqual({ status: "OK" });
    expect((await m.getMemberDetail(m.SAMPLE_MEMBER_ID))!.member).toMatchObject({ status: "SUSPENDED", withdrawalRequest: { effectiveAt: EFFECTIVE_AT } });

    // The request is offered first, so the member can cancel it; the suspension still applies after.
    expect((await m.login({ identifier: ID, password: PASSWORD, keepSignedIn: false })).status).toBe("WITHDRAWAL_PENDING");
    expect(await m.login({ identifier: ID, password: PASSWORD, keepSignedIn: false, cancelWithdrawal: true })).toEqual({ status: "SUSPENDED" });
    expect(m.withdrawalStore().request).toBeNull();
    expect(await m.session.getSession()).toBeNull();
    expect((await m.getMemberDetail(m.SAMPLE_MEMBER_ID))!.member).toMatchObject({ status: "SUSPENDED", withdrawalRequest: null });
  });

  it("takes effect 30 days after the request: withdrawn, unknown at sign-in, applied at effectiveAt with the amounts of that moment", async () => {
    const m = await load();
    pendingSettlement(m, "st-approved", 20_000);
    pendingSettlement(m, "st-waiting", 10_000);
    const { info, input, result } = await requestWithdrawal(m);
    expect(result).toEqual({ status: "REQUESTED", effectiveAt: EFFECTIVE_AT });
    const keys = { overlay: m.mockCreator.integrationKey, sms: m.bankSmsStore().key };
    // During the 30 days an operator approves one of the waiting requests: it is paid, not forfeited.
    expect(await m.decideSettlement(OP, { id: "st-approved", decision: "APPROVE", note: "확인 완료" })).toEqual({ status: "OK" });

    // A moment before the date it is still a request.
    vi.setSystemTime(Date.parse(EFFECTIVE_AT) - 1);
    expect(m.isWithdrawn()).toBe(false);
    expect(m.isWithdrawalRequested()).toBe(true);

    // From the date on it counts as withdrawn everywhere, also before the lazy apply ran.
    vi.setSystemTime(Date.parse(EFFECTIVE_AT) + 3_600_000);
    expect(m.isWithdrawn()).toBe(true);
    expect(m.isWithdrawalRequested()).toBe(false);
    expect(m.withdrawalOf()).toBeNull();
    expect(m.resolveAccount(ID)).toBeNull();
    expect(m.creatorAccessOpen()).toBe(false);
    await signIn(m);
    expect(await m.session.getSession()).toBeNull();
    // A console page opened before the date cannot decide the request that the 탈퇴 forfeits.
    expect(await m.decideSettlement(OP, { id: "st-waiting", decision: "APPROVE", note: "늦은 승인" })).toEqual({ status: "INVALID", message: "이미 처리된 정산 신청이에요." });

    // Applied (here by the decision above, which runs it first; the console's reads and sign-in do too): dated at
    // effectiveAt, with the balance and earnings of that moment — not the amounts consented to a month before.
    m.purgeExpired();
    expect(m.withdrawalStore().request).toBeNull();
    expect(m.withdrawalOf()).toMatchObject({
      at: EFFECTIVE_AT,
      requestedAt: T0.toISOString(),
      requestId: key(1),
      forfeitedFn: 5_000,
      forfeitedEarningsFn: info.unsettledFn - 20_000,
      // What the member agreed to at the request stays next to it, for audit.
      consented: { fn: 5_000, earningsFn: info.unsettledFn },
      nickname: "홍길동"
    });
    expect(m.settlement.requests.find((r) => r.id === "st-approved")).toMatchObject({ status: "APPROVED" });
    expect(m.settlement.requests.find((r) => r.id === "st-waiting")).toMatchObject({ status: "FORFEITED", review: { at: EFFECTIVE_AT, by: "회원 탈퇴" } });
    expect(m.settlement).toMatchObject({ availableFn: 0, terms: null, registration: null });
    expect(m.account.fnBalance).toBe(0);
    expect(Object.values(m.account.linkedLoginProviders).every((p) => p === null)).toBe(true);
    expect(m.mockCreator.integrationKey).not.toBe(keys.overlay);
    expect(m.bankSmsStore().key).not.toBe(keys.sms);
    expect(m.applyDueWithdrawal()).toBe(false); // once

    expect(await m.login({ identifier: ID, password: PASSWORD, keepSignedIn: false, cancelWithdrawal: true })).toEqual({ status: "UNKNOWN_ID" });
    // The request id still answers the same (the record keeps it).
    expect(await m.withdrawAccount(input)).toEqual({ status: "REQUESTED", effectiveAt: EFFECTIVE_AT });
    // The console lists the account as 탈퇴, its retention counted from the day it took effect.
    const member = (await m.getMemberDetail(m.SAMPLE_MEMBER_ID))!.member;
    expect(member).toMatchObject({ status: "WITHDRAWN", withdrawalRequest: null, withdrawal: { at: EFFECTIVE_AT, forfeitedFn: 5_000 } });
    expect(member.withdrawal!.retention.find((r) => r.category === "CONTRACT")!.until).toBe("2031-12-02T03:00:00.000Z");
    expect(member.withdrawal!.retention.find((r) => r.category === "PERSON_KEY")!.until).toBe("2027-06-02T03:00:00.000Z");
  });

  it("returns a 심사 대기 정산 an operator rejects during the 30 days to the account, and forfeits it on the day", async () => {
    const m = await load();
    pendingSettlement(m, "st-rejected", 20_000);
    pendingSettlement(m, "st-waiting", 10_000);
    const available = m.settlement.availableFn;
    const { info, result } = await requestWithdrawal(m);
    expect(result.status).toBe("REQUESTED");
    expect(info.unsettledFn).toBe(available + 30_000);

    vi.setSystemTime(new Date("2026-11-10T00:00:00.000Z"));
    expect(await m.decideSettlement(OP, { id: "st-rejected", decision: "REJECT", note: "자료 보완 필요" })).toEqual({ status: "OK" });
    // Back in 정산 가능, the member's as before (the account still exists).
    expect(m.settlement.availableFn).toBe(available + 20_000);
    expect(m.settlement.requests.find((r) => r.id === "st-rejected")).toMatchObject({ status: "REJECTED", review: { by: "운영자1" } });

    vi.setSystemTime(new Date("2026-12-05T00:00:00.000Z"));
    await m.listMembers(); // the console's read applies it
    expect(m.withdrawalOf()).toMatchObject({ at: EFFECTIVE_AT, forfeitedEarningsFn: available + 30_000 });
    expect(m.settlement.availableFn).toBe(0);
    // The rejected request stays 반려 (its FN were forfeited as 정산 가능); the one still waiting ends as 탈퇴 소멸.
    expect(m.settlement.requests.find((r) => r.id === "st-rejected")!.status).toBe("REJECTED");
    expect(m.settlement.requests.find((r) => r.id === "st-waiting")!.status).toBe("FORFEITED");
  });

  it("keeps the e-mail and nickname taken during the 30 days, and lets the same person sign up again after them", async () => {
    const m = await load();
    const personKey = m.currentPersonKey();
    expect((await requestWithdrawal(m)).result.status).toBe("REQUESTED");
    const agreements = { service: true, privacy: true, marketing: false };
    const again = async (email: string, nickname: string) =>
      m.signup({ email, password: "newpass12!", nickname, phoneVerificationToken: await phoneToken("SIGNUP", "010-1234-5678"), agreements });

    // The account still exists: its e-mail and nickname are refused like any member's.
    expect(await m.checkEmailAvailability("user@ssumnation.kr")).toEqual({ available: false });
    expect(await m.checkNicknameAvailability("홍길동")).toEqual({ available: false, reason: "DUPLICATE" });
    expect(await again("user@ssumnation.kr", "다시왔어요")).toEqual({ status: "EMAIL_TAKEN" });
    expect(await again("again@ssumnation.kr", "홍길동")).toEqual({ status: "NICKNAME_TAKEN" });
    expect(m.isWithdrawalRequested()).toBe(true);

    // After the date the sign-up applies it first: the same e-mail and nickname are free, and the same phone is the
    // same person while the withdrawn account's 본인 확인 값 is kept (6 months from the day it took effect).
    vi.setSystemTime(new Date("2026-12-02T03:00:01.000Z"));
    expect(await m.checkEmailAvailability("user@ssumnation.kr")).toEqual({ available: true });
    expect(await again("user@ssumnation.kr", "홍길동")).toEqual({ status: "CREATED" });
    expect(m.isWithdrawn()).toBe(false);
    expect(m.withdrawalStore().past).toEqual([expect.objectContaining({ at: EFFECTIVE_AT, requestedAt: T0.toISOString(), requestId: key(1) })]);
    expect(m.account).toMatchObject({ nickname: "홍길동", fnBalance: 0 });
    expect(m.currentPersonKey()).toBe(personKey);
    expect(await m.login({ identifier: "user@ssumnation.kr", password: "newpass12!", keepSignedIn: false })).toEqual({ status: "SUCCESS" });
  });
});
