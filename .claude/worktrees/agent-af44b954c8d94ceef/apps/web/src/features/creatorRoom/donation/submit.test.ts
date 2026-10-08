import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores } from "@/test/mockEnv";
import type { DonationRequest, DonationResult } from "@/services/donations/donationTypes";
import { submitDonation, type FormRequest, type SubmitState } from "./submit";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * The donation panel after a lost answer (network error): the next confirm re-sends the earlier request with its key
 * first, so an edit or a toggle in between can never debit twice.
 */
async function load() {
  const { mockAccount } = await import("@/services/account/mockStore");
  const { mockWallet } = await import("@/services/wallet/mockWalletStore");
  const { requestDonation } = await import("@/services/donations/donate");
  mockAccount.fnBalance = 50_000;
  let n = 0;
  const sent: DonationRequest[] = [];
  /** The real Donation Core; `lose` drops the next answer after the server handled the request. */
  const net = { lose: false };
  const send = async (r: DonationRequest): Promise<DonationResult> => {
    sent.push(r);
    const result = await requestDonation(r);
    if (net.lose) {
      net.lose = false;
      throw new Error("network");
    }
    return result;
  };
  const state: SubmitState<"TEXT"> = { unsettled: null };
  const submit = (form: FormRequest) => submitDonation(state, form, { formKey: "TEXT", chatText: form.type === "TEXT" ? form.message : "" }, send, () => `key-${String(++n).padStart(12, "0")}`);
  return { submit, send, sent, net, state, account: mockAccount, wallet: mockWallet };
}

const form = (amount: number, message = "화이팅", hideProfile = false): FormRequest => ({ type: "TEXT", amount, message, voiceId: null, creatorId: "c1", hideProfile, nicknameId: null, memberId: null });

describe("후원 재시도 (결과를 모를 때)", () => {
  beforeEach(() => resetMockStores());

  it("shows the earlier donation when it had gone through, without sending the edited one", async () => {
    const m = await load();
    m.net.lose = true;
    await expect(m.submit(form(1_000))).rejects.toThrow("network");
    expect(m.account.fnBalance).toBe(49_000); // it did go through
    // The supporter edits the amount and toggles 프로필 숨기기, then confirms again.
    const { sent, result } = await m.submit(form(2_000, "화이팅", true));
    expect(result).toMatchObject({ status: "COMPLETED", fnAmount: 1_000 });
    expect(sent.request).toMatchObject({ amount: 1_000, hideProfile: false });
    expect(m.sent.map((r) => r.idempotencyKey)).toEqual([m.sent[0].idempotencyKey, m.sent[0].idempotencyKey]); // the same key, twice
    expect(m.account.fnBalance).toBe(49_000);
    expect(m.wallet.donations).toHaveLength(1);
    expect(m.state.unsettled).toBeNull();
    // The next confirm is a new donation.
    expect((await m.submit(form(2_000))).result).toMatchObject({ status: "COMPLETED", fnAmount: 2_000 });
    expect(m.account.fnBalance).toBe(47_000);
  });

  it("sends the edited request once the earlier one is known to have failed without a debit", async () => {
    const m = await load();
    m.account.fnBalance = 1_500;
    m.net.lose = true;
    await expect(m.submit(form(2_000))).rejects.toThrow("network"); // INSUFFICIENT_FN, but the answer was lost
    const { sent, result } = await m.submit(form(1_000));
    expect(result).toMatchObject({ status: "COMPLETED", fnAmount: 1_000 });
    expect(sent.request).toMatchObject({ amount: 1_000 });
    expect(new Set(m.sent.map((r) => r.idempotencyKey)).size).toBe(2); // the earlier key re-sent, then a new one
    expect(m.account.fnBalance).toBe(500);
  });

  it("shows the earlier answer when nothing was edited, and keeps an unknown outcome for the next try", async () => {
    const m = await load();
    m.account.fnBalance = 500;
    m.net.lose = true;
    await expect(m.submit(form(1_000))).rejects.toThrow("network");
    expect(m.state.unsettled).not.toBeNull();
    expect((await m.submit(form(1_000))).result).toEqual({ status: "INSUFFICIENT_FN", balance: 500, required: 1_000 });
    expect(m.sent).toHaveLength(2);
    expect(m.state.unsettled).toBeNull();

    // Still processing on the server: stays unsettled, and the next confirm asks about it again.
    const busy: SubmitState<"TEXT"> = { unsettled: null };
    const asked: DonationRequest[] = [];
    const pending = async (r: DonationRequest): Promise<DonationResult> => {
      asked.push(r);
      return { status: "IN_PROGRESS" };
    };
    await submitDonation(busy, form(1_000), { formKey: "TEXT", chatText: "" }, pending, () => "key-busy-0000000001");
    await submitDonation(busy, form(3_000), { formKey: "TEXT", chatText: "" }, pending, () => "key-busy-0000000002");
    expect(asked.map((r) => [r.idempotencyKey, "amount" in r ? r.amount : null])).toEqual([
      ["key-busy-0000000001", 1_000],
      ["key-busy-0000000001", 1_000]
    ]);
    expect(busy.unsettled?.request.idempotencyKey).toBe("key-busy-0000000001");
  });
});
