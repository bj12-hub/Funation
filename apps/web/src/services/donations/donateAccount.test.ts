import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, rejoinWithPhone, resetMockStores, signInAs } from "@/test/mockEnv";

/** A held delay (`hold(ms)`) waits until released — the donation's wait before the debit (600 ms) — so it stays in flight. */
const delay = vi.hoisted(() => ({ gates: new Map<number, Promise<void>>() }));
vi.mock("@/lib/mock", () => ({
  USE_MOCK: true,
  mockDelay: async (ms?: number) => {
    const gate = ms === undefined ? undefined : delay.gates.get(ms);
    if (gate) await gate;
  }
}));
vi.mock("@/lib/session", () => mockSessionModule());

const DONATION_WAIT = 600; // donate.ts: the wait before the debit

/** Holds every mock delay of `ms` until the returned function is called. */
function hold(ms: number) {
  let release: () => void = () => {};
  delay.gates.set(ms, new Promise<void>((resolve) => (release = resolve)));
  return () => {
    delay.gates.delete(ms);
    release();
  };
}

async function load(balance = 100_000) {
  const { mockAccount } = await import("@/services/account/mockStore");
  const { mockWallet } = await import("@/services/wallet/mockWalletStore");
  const { requestDonation } = await import("./donate");
  const { agreeChargeTerms, requestCharge } = await import("@/services/wallet/charge");
  const { recordWithdrawal } = await import("@/services/account/withdrawalRecord");
  mockAccount.fnBalance = balance;
  return { requestDonation, agreeChargeTerms, requestCharge, recordWithdrawal, account: mockAccount, wallet: mockWallet };
}
type M = Awaited<ReturnType<typeof load>>;

/** Every donation type debits in the Donation Core (`requestDonation`): 룰렛 · 뽑기 · 퀘스트 · 미니 · 크루 멤버 지정 too. */
const base = { creatorId: "c1", hideProfile: false };
const CASES: [string, Record<string, unknown>][] = [
  ["일반 후원", { ...base, type: "TEXT", amount: 1_000, message: "화이팅", voiceId: null }],
  ["미니 후원", { ...base, type: "MINI", amount: 500, text: "안녕", colorId: "pink" }],
  ["룰렛", { ...base, type: "ROULETTE", amount: 10_000 }],
  ["뽑기", { ...base, type: "GACHA", gachaId: "gacha-1", termsAgreed: true, expectedAmount: 3_000 }],
  ["퀘스트 후원", { ...base, type: "QUEST", title: "노래 한 곡", successReward: 10_000, timeLimitSec: 600, creatorDecides: true, termsAgreed: true }],
  ["크루 멤버 지정", { ...base, creatorId: "c4", type: "TEXT", amount: 3_000, message: "화이팅", voiceId: null, memberId: "cm-c4-2" }]
];

/** The new account (재가입) charges 20,000 FN: FN that are its own, not the withdrawn account's. */
async function newAccountCharges(m: M) {
  await rejoinWithPhone("010-0000-0000");
  expect((await m.agreeChargeTerms({ guardian: true, privacy: true, payment: true })).status).toBe("AGREED");
  expect(await m.requestCharge({ amount: { customAmount: 20_000 }, methodId: "KAKAO_PAY", idempotencyKey: key(900) })).toMatchObject({ status: "COMPLETED", balance: 20_000 });
}

/**
 * The debit side of 2026-10-10 (FN land only on the account that is still there): a donation debits only the account
 * whose session it read, while that account still holds the slot, active — checked in the step that debits.
 */
describe("후원 · the account the request started with", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => delay.gates.clear());

  it.each(CASES)("%s: goes through for the account that sent it (the request is valid)", async (_, payload) => {
    const m = await load();
    expect(await m.requestDonation({ ...payload, idempotencyKey: key(1) })).toMatchObject({ status: "COMPLETED" });
    expect(m.wallet.donations).toHaveLength(1);
  });

  it.each(CASES)("%s: never debits the account that took the slot during the wait (탈퇴, 재가입, a new charge)", async (_, payload) => {
    const m = await load();
    const release = hold(DONATION_WAIT);
    const sending = m.requestDonation({ ...payload, idempotencyKey: key(1) });
    await Promise.resolve();
    await newAccountCharges(m);
    release();
    expect(await sending).toEqual({ status: "UNAUTHORIZED" });
    // The new account keeps its charge, and nothing was sent in its name.
    expect(m.account.fnBalance).toBe(20_000);
    expect(m.wallet.donations).toEqual([]);
  });

  it("leaves the new account's own requests its own: the same key from it is a donation of its own", async () => {
    signInAs("u-hongGD123"); // the slot's member id, as lib/session gives it (a 재가입 moves the withdrawn account's keys)
    const m = await load();
    const release = hold(DONATION_WAIT);
    const sending = m.requestDonation({ ...CASES[0][1], idempotencyKey: key(1) });
    await Promise.resolve();
    await newAccountCharges(m);
    release();
    expect(await sending).toEqual({ status: "UNAUTHORIZED" });
    // The same key from the new account is a request of its own (the old one went with the withdrawn account).
    expect(await m.requestDonation({ ...CASES[0][1], idempotencyKey: key(1) })).toMatchObject({ status: "COMPLETED", balance: 19_000 });
  });

  it("debits nothing for an account that withdrew after its session was read", async () => {
    const m = await load(5_000);
    m.recordWithdrawal({ at: new Date().toISOString(), requestId: "w-test", forfeitedFn: 5_000, forfeitedEarningsFn: 0 });
    expect(await m.requestDonation({ ...CASES[0][1], idempotencyKey: key(1) })).toEqual({ status: "UNAUTHORIZED" });
    expect(m.account.fnBalance).toBe(5_000);
    expect(m.wallet.donations).toEqual([]);
  });
});
