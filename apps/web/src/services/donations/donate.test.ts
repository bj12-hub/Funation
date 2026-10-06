import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** Donation Core (creator room, 610:138 · 613:*): one debit path for every donation type. */
async function load(balance = 50_000) {
  const { mockAccount } = await import("@/services/account/mockStore");
  const { mockWallet } = await import("@/services/wallet/mockWalletStore");
  const { requestDonation } = await import("./donate");
  mockAccount.fnBalance = balance;
  return { requestDonation, account: mockAccount, wallet: mockWallet };
}

const base = { creatorId: "c1", hideProfile: false };
const text = (amount: number, n = 1) => ({ ...base, type: "TEXT", amount, message: "화이팅", voiceId: null, idempotencyKey: key(n) });

describe("Donation Core", () => {
  beforeEach(() => resetMockStores());

  it("debits a text donation and records it in FN 후원내역", async () => {
    const { requestDonation, account, wallet } = await load();
    const res = await requestDonation(text(1_000));
    expect(res).toMatchObject({ status: "COMPLETED", fnAmount: 1_000, balance: 49_000 });
    expect(account.fnBalance).toBe(49_000);
    expect(wallet.donations[0]).toMatchObject({ creatorId: "c1", fnAmount: 1_000, status: "COMPLETED" });
  });

  it("charges the signature's catalog price the supporter confirmed, never a client amount", async () => {
    const { requestDonation, account } = await load();
    const signature = (n: number, expectedAmount?: number) => ({ ...base, type: "SIGNATURE", signatureId: "sig-zero2", message: "", amount: 1, expectedAmount, idempotencyKey: key(n) });
    expect(await requestDonation(signature(1))).toEqual({ status: "INVALID" }); // no confirmed price
    expect(await requestDonation(signature(2, 1))).toEqual({ status: "PRICE_CHANGED", amount: 10_002 }); // not the catalog price
    const res = await requestDonation(signature(3, 10_002));
    expect(res).toMatchObject({ status: "COMPLETED", fnAmount: 10_002 });
    expect(account.fnBalance).toBe(50_000 - 10_002);
  });

  it("refuses a price the creator changed after the panel loaded, without debiting (PRICE_CHANGED)", async () => {
    const { requestDonation, account, wallet } = await load();
    const { mockSignatures } = await import("./signatureCore");
    const before = mockSignatures.items.find((s) => s.id === "sig-zero2")!.price;
    mockSignatures.items.find((s) => s.id === "sig-zero2")!.price = before + 5_000;
    const sent = { ...base, type: "SIGNATURE", signatureId: "sig-zero2", message: "축하해요", expectedAmount: before, idempotencyKey: key(1) };
    expect(await requestDonation(sent)).toEqual({ status: "PRICE_CHANGED", amount: before + 5_000 });
    expect(await requestDonation(sent)).toEqual({ status: "PRICE_CHANGED", amount: before + 5_000 }); // retry: same answer
    expect(await requestDonation({ ...sent, expectedAmount: before + 5_000 })).toEqual({ status: "CONFLICT" }); // the price is part of the request
    expect(account.fnBalance).toBe(50_000);
    expect(wallet.donations).toHaveLength(0);
    expect(await requestDonation({ ...sent, expectedAmount: before + 5_000, idempotencyKey: key(2) })).toMatchObject({ status: "COMPLETED", fnAmount: before + 5_000 });
  });

  it("refuses supporter text with a platform forbidden word before any debit", async () => {
    const { requestDonation, account, wallet } = await load();
    const { MOCK_FORBIDDEN_WORDS } = await import("@/services/account/mockStore");
    const bad = `나는 ${MOCK_FORBIDDEN_WORDS[0]}`;
    const refused = { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
    expect(await requestDonation({ ...text(1_000, 1), message: bad })).toEqual(refused);
    expect(await requestDonation({ ...base, type: "MINI", amount: 1_000, text: `hi ${MOCK_FORBIDDEN_WORDS[1].toUpperCase()}`, colorId: "pink", idempotencyKey: key(2) })).toEqual(refused);
    const quest = { ...base, type: "QUEST", title: bad, successReward: 10_000, timeLimitSec: 600, creatorDecides: true, termsAgreed: true, idempotencyKey: key(3) };
    expect(await requestDonation(quest)).toEqual(refused);
    const drawing = { ...base, type: "DRAWING", amount: 1_000, title: bad, image: "data:image/png;base64,AAAA", showProcess: true, canvasMode: false, termsAgreed: true, idempotencyKey: key(4) };
    expect(await requestDonation(drawing)).toEqual(refused);
    expect(await requestDonation({ ...base, type: "SIGNATURE", signatureId: "sig-zero2", message: bad, expectedAmount: 10_002, idempotencyKey: key(5) })).toEqual(refused);
    expect(account.fnBalance).toBe(50_000);
    expect(wallet.donations).toHaveLength(0);
    // Fixed text is accepted under the same key (a refused request is not recorded).
    expect((await requestDonation({ ...text(1_000, 1), message: "화이팅" })).status).toBe("COMPLETED");
  });

  it("shows text with the creator's 금지어 as the 대체 메시지 on stream, keeping the record and the payment", async () => {
    const { requestDonation, account, wallet } = await load();
    const creators = await import("@/services/creators/creators");
    const c1 = (await creators.getCreatorById("c1"))!;
    vi.spyOn(creators, "getCreatorById").mockResolvedValue({ ...c1, id: "studio" });
    const { mockAlerts } = await import("@/services/creator/alertCore");
    const { donationPageStore } = await import("@/services/creator/donationPageCore");
    const last = () => mockAlerts.items.at(-1)!;
    const send = (n: number, message: string) => requestDonation({ ...text(1_000, n), creatorId: "studio", message });
    donationPageStore.replacement = { applyToNickname: false, applyToText: true, bannedWords: ["클리어"], message: "응원 고마워요" };

    expect((await send(1, "보스 클리어 축하해요")).status).toBe("COMPLETED");
    expect(last()).toMatchObject({ donor: "홍길동", message: "응원 고마워요" }); // the alert and its TTS
    expect(wallet.donations[0].message).toBe("보스 클리어 축하해요");
    expect(account.fnBalance).toBe(49_000);
    await send(2, "오늘도 화이팅");
    expect(last().message).toBe("오늘도 화이팅");

    // 닉네임에 대체 메시지 적용 (off by default): the name shown is replaced too; 텍스트 내용 off keeps the text.
    donationPageStore.replacement = { applyToNickname: true, applyToText: false, bannedWords: ["길동"], message: "응원 고마워요" };
    await send(3, "길동님 최고");
    expect(last()).toMatchObject({ donor: "응원 고마워요", message: "길동님 최고" });
    // An empty 대체 메시지 (2026-10-06 결정): the default text, and the name shows 익명.
    donationPageStore.replacement = { applyToNickname: true, applyToText: true, bannedWords: ["길동"], message: "" };
    await send(4, "길동님 최고");
    expect(last()).toMatchObject({ donor: "익명", message: "(금지어가 포함된 메시지예요)" });
    expect(wallet.donations.map((d) => d.message)).toContain("길동님 최고");
  });

  it("gives every donation its own id, even when two finish in the same millisecond", async () => {
    const { requestDonation, wallet } = await load();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-06T12:00:00"));
      const [a, b] = await Promise.all([requestDonation(text(1_000, 1)), requestDonation(text(1_000, 2))]);
      if (a.status !== "COMPLETED" || b.status !== "COMPLETED") throw new Error("not completed");
      expect(a.donationId).not.toBe(b.donationId);
      expect(a.donationId).toMatch(/^dn-/);
      expect(new Set(wallet.donations.map((d) => d.id)).size).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("enforces the minimum amount and rejects non-integer amounts", async () => {
    const { requestDonation, account } = await load();
    expect((await requestDonation(text(999, 3))).status).toBe("INVALID");
    expect((await requestDonation(text(1_000.5, 4))).status).toBe("INVALID");
    expect(account.fnBalance).toBe(50_000);
  });

  it("returns INSUFFICIENT_FN without debiting", async () => {
    const { requestDonation, account } = await load(500);
    expect(await requestDonation(text(1_000, 5))).toEqual({ status: "INSUFFICIENT_FN", balance: 500, required: 1_000 });
    expect(account.fnBalance).toBe(500);
  });

  it("is idempotent per key and rejects a different request under the same key", async () => {
    const { requestDonation, account, wallet } = await load();
    const first = await requestDonation(text(2_000, 6));
    expect(await requestDonation(text(2_000, 6))).toEqual(first);
    expect(await requestDonation(text(3_000, 6))).toEqual({ status: "CONFLICT" });
    expect(account.fnBalance).toBe(48_000);
    expect(wallet.donations).toHaveLength(1);
  });

  it("requires a session and an existing creator", async () => {
    const { requestDonation, account } = await load();
    expect((await requestDonation({ ...text(1_000, 7), creatorId: "nope" })).status).toBe("NOT_FOUND");
    signIn(null);
    expect((await requestDonation(text(1_000, 8))).status).toBe("UNAUTHORIZED");
    expect(account.fnBalance).toBe(50_000);
  });
});
