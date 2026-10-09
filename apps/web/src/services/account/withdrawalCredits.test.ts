import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, rejoinWithPhone, resetMockStores, settleSampleCharges, settleSamplePlatformDonations, signIn } from "@/test/mockEnv";

/**
 * `during` runs inside the next mock delay; a held delay (`hold(ms)`) waits until released — e.g. the payment provider
 * round trip of a charge (900 ms) or the wait before an 출석 보상 is paid (500 ms) — so a credit stays on its way.
 */
const delay = vi.hoisted(() => ({ during: null as null | (() => void), gates: new Map<number, Promise<void>>() }));
vi.mock("@/lib/mock", () => ({
  USE_MOCK: true,
  mockDelay: async (ms?: number) => {
    const run = delay.during;
    delay.during = null;
    run?.();
    const gate = ms === undefined ? undefined : delay.gates.get(ms);
    if (gate) await gate;
  }
}));
vi.mock("@/lib/session", () => mockSessionModule());
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const CHARGE_CALL = 900; // charge.ts: the payment provider round trip
const CHECK_IN_WAIT = 500; // attendance.ts: check-in → reward paid

/** Holds every mock delay of `ms` until the returned function is called. */
function hold(ms: number) {
  let release: () => void = () => {};
  delay.gates.set(ms, new Promise<void>((resolve) => (release = resolve)));
  return () => {
    delay.gates.delete(ms);
    release();
  };
}

async function load() {
  const withdrawal = await import("./withdrawal");
  const core = await import("./withdrawalCore");
  const { mockAccount } = await import("./mockStore");
  const { mockWallet } = await import("@/services/wallet/mockWalletStore");
  const { requestCharge } = await import("@/services/wallet/charge");
  const { confirmChargePayment } = await import("@/services/wallet/chargeCore");
  const { IN_FLIGHT_WAIT_MS } = await import("@/services/wallet/inFlightCore");
  const { listChargeRecords, getWalletOverview } = await import("@/services/wallet/walletHistory");
  const { mockCredits } = await import("@/services/wallet/mockCreditStore");
  const { checkIn } = await import("@/services/attendance/attendance");
  const { getPaymentsView } = await import("@/services/admin/payments");
  const { recordWithdrawal } = await import("./withdrawalRecord");
  // The member agreed to the FN 충전 terms before (the check is not what these tests are about).
  mockWallet.chargeTermsAgreedAt = new Date().toISOString();
  return {
    ...withdrawal,
    ...core,
    account: mockAccount,
    wallet: mockWallet,
    credits: mockCredits,
    requestCharge,
    confirmChargePayment,
    IN_FLIGHT_WAIT_MS,
    listChargeRecords,
    getWalletOverview,
    checkIn,
    getPaymentsView,
    recordWithdrawal
  };
}
type M = Awaited<ReturnType<typeof load>>;

const PASSWORD = "password"; // the mock account's initial password (services/account/mockStore.ts)
const supporter = (n: number, fnBalance: number) => ({ requestId: key(n), confirmed: true, forfeitAgreed: true, fnBalance, unsettledFn: 0, password: PASSWORD });
const charge = (m: M, n: number, fnAmount = 10_000) => m.requestCharge({ amount: { customAmount: fnAmount }, methodId: "KAKAO_PAY", idempotencyKey: key(n) });

describe("회원 탈퇴 · 처리 중인 충전 (2026-10-10 결정)", () => {
  beforeEach(async () => {
    resetMockStores();
    signIn(["SUPPORTER"]);
    delay.during = null;
    delay.gates.clear();
    await settleSamplePlatformDonations(); // the sample PENDING 플랫폼 후원 is another block (2026-10-09 결정)
  });
  afterEach(() => {
    vi.useRealTimers();
    delay.gates.clear();
  });

  it("waits while the sample's 처리중 charge has no 결제 확인, which the mock never gives by itself", async () => {
    const m = await load();
    // ch1 (신용카드 10,000 FN) is 처리중: its FN are not in the balance yet.
    expect(m.listChargeRecords().filter((c) => c.status === "PROCESSING").map((c) => [c.id, c.fnAmount])).toEqual([["ch1", 10_000]]);
    expect(await m.getWithdrawalInfo()).toMatchObject({ fnBalance: 5_000, pendingCharges: 1 });
    expect(await m.withdrawAccount(supporter(1, 5_000))).toEqual({ status: "CHARGE_PENDING", count: 1 });
    expect(m.isWithdrawn()).toBe(false);

    // The payment is confirmed: its FN land on the account, which can go once the member agreed to the new amount.
    expect(m.confirmChargePayment("ch1", "COMPLETED")).toBe("CREDITED");
    expect(m.listChargeRecords().find((c) => c.id === "ch1")).toMatchObject({ status: "COMPLETED", paidAmount: 11_000 });
    expect(await m.getWithdrawalInfo()).toMatchObject({ fnBalance: 15_000, pendingCharges: 0 });
    expect(m.confirmChargePayment("ch1", "COMPLETED")).toBe("NOT_PROCESSING"); // confirmed once
    expect(await m.withdrawAccount(supporter(2, 5_000))).toMatchObject({ status: "INVALID", message: "남은 FN이 바뀌었어요. 금액을 다시 확인해 주세요." });
    expect(await m.withdrawAccount(supporter(3, 15_000))).toEqual({ status: "WITHDRAWN" });
  });

  it("lets the account go once a 처리중 charge failed, with nothing credited (the test helper)", async () => {
    const m = await load();
    await settleSampleCharges();
    expect(m.listChargeRecords().find((c) => c.id === "ch1")).toMatchObject({ status: "CANCELLED", paidAmount: 0, transactionId: null });
    expect(await m.getWithdrawalInfo()).toMatchObject({ fnBalance: 5_000, pendingCharges: 0 });
    expect(await m.withdrawAccount(supporter(1, 5_000))).toEqual({ status: "WITHDRAWN" });
  });

  it("counts a charge whose payment provider call is still running (another tab), on the screen and on the button", async () => {
    const m = await load();
    await settleSampleCharges();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const release = hold(CHARGE_CALL);
    const charging = charge(m, 10);

    // The screen waits a moment for it; it is still on its way after that, so the card shows it.
    const info = m.getWithdrawalInfo();
    await vi.advanceTimersByTimeAsync(m.IN_FLIGHT_WAIT_MS);
    expect(await info).toMatchObject({ fnBalance: 5_000, pendingCharges: 1, pendingAttendanceRewards: 0 });
    // So does the button.
    const pressed = m.withdrawAccount(supporter(1, 5_000));
    await vi.advanceTimersByTimeAsync(m.IN_FLIGHT_WAIT_MS);
    expect(await pressed).toEqual({ status: "CHARGE_PENDING", count: 1 });
    expect(m.isWithdrawn()).toBe(false);

    // The provider answers: the FN land on the account, which can go for the amount after it.
    release();
    expect(await charging).toMatchObject({ status: "COMPLETED", fnAmount: 10_000, balance: 15_000 });
    expect(await m.getWithdrawalInfo()).toMatchObject({ fnBalance: 15_000, pendingCharges: 0 });
    expect(await m.withdrawAccount(supporter(2, 15_000))).toEqual({ status: "WITHDRAWN" });
    expect(m.withdrawalOf()).toMatchObject({ forfeitedFn: 15_000 });
  });

  it("waits for a charge on its way before answering, so the screen and the button show the state after it", async () => {
    const m = await load();
    await settleSampleCharges();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    // The provider answers 50 ms after the screen is opened.
    let release = hold(CHARGE_CALL);
    const first = charge(m, 10);
    setTimeout(release, 50);
    const info = m.getWithdrawalInfo();
    await vi.advanceTimersByTimeAsync(50);
    expect(await info).toMatchObject({ fnBalance: 15_000, pendingCharges: 0 });
    expect(await first).toMatchObject({ status: "COMPLETED" });

    // The member presses 탈퇴 for the 15,000 FN shown while another charge is on its way: the button waits for it, and
    // the balance it brought needs a new look (not a "charge in progress" refusal for one that has just landed).
    release = hold(CHARGE_CALL);
    const second = charge(m, 11, 5_000);
    setTimeout(release, 50);
    const pressed = m.withdrawAccount(supporter(1, 15_000));
    await vi.advanceTimersByTimeAsync(50);
    expect(await pressed).toEqual({ status: "INVALID", message: "남은 FN이 바뀌었어요. 금액을 다시 확인해 주세요." });
    expect(await second).toMatchObject({ status: "COMPLETED", balance: 20_000 });
    expect(m.isWithdrawn()).toBe(false);
  });

  it("is checked again with the write: a charge started while the password is checked stops the withdrawal", async () => {
    const m = await load();
    await settleSampleCharges();
    const release = hold(CHARGE_CALL);
    let started: Promise<unknown> | null = null;
    delay.during = () => void (started = charge(m, 10)); // another tab, during the password check
    expect(await m.withdrawAccount(supporter(1, 5_000))).toEqual({ status: "CHARGE_PENDING", count: 1 });
    expect(m.isWithdrawn()).toBe(false);
    release();
    // The account is still there, so the charge lands on it.
    expect(await started).toMatchObject({ status: "COMPLETED", balance: 15_000 });
  });

  it("sends nothing to the provider for an account that withdrew after its session was read", async () => {
    const m = await load();
    m.recordWithdrawal({ at: new Date().toISOString(), requestId: "w-test", forfeitedFn: 5_000, forfeitedEarningsFn: 0 });
    expect(await charge(m, 10)).toEqual({ status: "UNAUTHORIZED" });
    expect(m.wallet.charges).toEqual([]);
    expect(m.wallet.uncreditedCharges).toEqual([]);
  });

  it("never credits a payment that completes after the account withdrew: not to a 재가입 account, and the console lists it", async () => {
    const m = await load();
    const release = hold(CHARGE_CALL);
    const charging = charge(m, 10);
    await Promise.resolve(); // the charge is on its way
    // The account goes around the block (records the withdrawal directly) and someone signs up in the slot.
    await rejoinWithPhone("010-0000-0000");
    release();
    expect(await charging).toEqual({ status: "UNAUTHORIZED" });
    expect(m.account.fnBalance).toBe(0);
    // The new account's history has no such charge; the payment is kept apart for the console.
    expect(m.listChargeRecords()).toEqual([]);
    expect((await m.getWalletOverview({ period: "all" }))!.entries).toEqual([]);
    expect(m.wallet.charges).toEqual([]);
    expect(m.wallet.uncreditedCharges).toEqual([expect.objectContaining({ fnAmount: 10_000, paidAmount: 11_000, methodLabel: "카카오페이", account: null })]);
    signIn(["ADMIN"]);
    const row = (await m.getPaymentsView())!.charges.find((c) => c.id === m.wallet.uncreditedCharges[0].id);
    expect(row).toMatchObject({ status: "COMPLETED", fnNotCredited: true, memberWithdrawn: true, memberName: "홍길동", refund: null, fnAmount: 10_000 });
    expect(row!.memberId).toMatch(/-w1$/);
  });

  it("never credits a 처리중 charge confirmed after the account withdrew; the console shows it as FN 미지급", async () => {
    const m = await load();
    await rejoinWithPhone("010-0000-0000");
    expect(m.confirmChargePayment("ch1", "COMPLETED")).toBe("NOT_CREDITED");
    expect(m.account.fnBalance).toBe(0);
    signIn(["ADMIN"]);
    const rows = (await m.getPaymentsView())!.charges;
    expect(rows.find((c) => c.id === "ch1")).toMatchObject({ status: "COMPLETED", fnNotCredited: true, memberWithdrawn: true });
    expect(rows.filter((c) => c.fnNotCredited)).toHaveLength(1);
  });
});

describe("회원 탈퇴 · 지급 중인 출석 보상 (2026-10-10 결정)", () => {
  beforeEach(async () => {
    resetMockStores();
    signIn(["SUPPORTER"]);
    delay.during = null;
    delay.gates.clear();
    await settleSamplePlatformDonations();
    await settleSampleCharges();
  });
  afterEach(() => {
    vi.useRealTimers();
    delay.gates.clear();
  });

  it("waits while an 출석 보상 is on its way, then lets the account go with it in the balance", async () => {
    const m = await load();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const release = hold(CHECK_IN_WAIT);
    const checking = m.checkIn();
    const info = m.getWithdrawalInfo();
    await vi.advanceTimersByTimeAsync(m.IN_FLIGHT_WAIT_MS);
    expect(await info).toMatchObject({ fnBalance: 5_000, pendingCharges: 0, pendingAttendanceRewards: 1 });
    const pressed = m.withdrawAccount(supporter(1, 5_000));
    await vi.advanceTimersByTimeAsync(m.IN_FLIGHT_WAIT_MS);
    expect(await pressed).toEqual({ status: "ATTENDANCE_PENDING", count: 1 });
    expect(m.isWithdrawn()).toBe(false);

    release();
    const checked = await checking;
    if (checked.status !== "CHECKED_IN") throw new Error(checked.status);
    expect(checked.balance).toBeGreaterThan(5_000);
    expect(await m.getWithdrawalInfo()).toMatchObject({ fnBalance: checked.balance, pendingAttendanceRewards: 0 });
    expect(await m.withdrawAccount(supporter(2, checked.balance))).toEqual({ status: "WITHDRAWN" });
  });

  it("is checked again with the write: a check-in during the password check stops the withdrawal", async () => {
    const m = await load();
    const release = hold(CHECK_IN_WAIT);
    let started: Promise<unknown> | null = null;
    delay.during = () => void (started = m.checkIn());
    expect(await m.withdrawAccount(supporter(1, 5_000))).toEqual({ status: "ATTENDANCE_PENDING", count: 1 });
    release();
    expect(await started).toMatchObject({ status: "CHECKED_IN" });
  });

  it("does not pay an 출석 보상 that lands after the account withdrew, also not to a 재가입 account", async () => {
    const m = await load();
    const release = hold(CHECK_IN_WAIT);
    const checking = m.checkIn();
    await Promise.resolve();
    const before = m.credits.credits.length;
    // Another person signs up in the slot (another phone, so today's check-in is not theirs).
    await rejoinWithPhone("010-9999-0000");
    release();
    expect(await checking).toEqual({ status: "UNAUTHORIZED" });
    expect(m.account.fnBalance).toBe(0);
    expect(m.credits.credits.length).toBe(before);
    expect((await m.getWalletOverview({ kind: "REWARD", period: "all" }))!.entries).toEqual([]);
  });

  it("does not check in an account that withdrew after its session was read", async () => {
    const m = await load();
    m.recordWithdrawal({ at: new Date().toISOString(), requestId: "w-test", forfeitedFn: 5_000, forfeitedEarningsFn: 0 });
    expect(await m.checkIn()).toEqual({ status: "UNAUTHORIZED" });
    expect(m.credits.credits).toEqual([]);
  });
});
