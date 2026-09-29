import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** Supporter identity (code-first): nicknames, grade/titles from server records, donation attribution. */
async function load() {
  const { mockAccount } = await import("@/services/account/mockStore");
  const { mockWallet } = await import("@/services/wallet/mockWalletStore");
  const identity = await import("./identity");
  const { requestDonation } = await import("@/services/donations/donate");
  mockAccount.fnBalance = 1_000_000;
  // Only the donations made in the test count: drop the seed history for exact numbers.
  vi.spyOn(await import("@/services/wallet/walletHistory"), "listDonationRecords").mockImplementation(() => mockWallet.donations);
  return { ...identity, requestDonation };
}

const text = (amount: number, n: number, nicknameId?: string | null) => ({
  creatorId: "c1",
  hideProfile: false,
  type: "TEXT",
  amount,
  message: "화이팅",
  voiceId: null,
  nicknameId,
  idempotencyKey: key(n)
});

describe("후원자 정체성", () => {
  beforeEach(() => resetMockStores());

  it("computes grade, global title and creator title from completed donations", async () => {
    const { getSupporterIdentity, requestDonation } = await load();
    await requestDonation(text(120_000, 1));
    const id = (await getSupporterIdentity())!;
    expect(id.grade).toMatchObject({ key: "VIP", last30Fn: 120_000 });
    expect(id.global.lifetimeFn).toBe(120_000);
    expect(id.global.earned).toEqual(["BRONZE", "SILVER", "GOLD"]);
    expect(id.global.best).toBe("GOLD");
    expect(id.stores[0]).toMatchObject({ creatorId: "c1", totalFn: 120_000, title: "TRUE" });
  });

  it("manages nicknames: add, duplicate, limit, rename, default, remove", async () => {
    const { addDonationNickname, renameDonationNickname, setDefaultDonationNickname, removeDonationNickname, getSupporterIdentity } = await load();
    expect(await addDonationNickname("응원단장")).toEqual({ status: "SAVED" });
    expect((await addDonationNickname("응원단장")).status).toBe("INVALID");
    expect((await addDonationNickname("x")).status).toBe("INVALID");
    expect((await addDonationNickname("admin계정")).status).toBe("INVALID");
    for (const n of ["별명둘", "별명셋", "별명넷"]) await addDonationNickname(n);
    expect((await addDonationNickname("별명다섯")).status).toBe("INVALID"); // 5 including the default
    let id = (await getSupporterIdentity())!;
    const extra = id.nicknames.find((n) => n.name === "응원단장")!;
    expect((await renameDonationNickname("nk-default", "바꿈")).status).toBe("INVALID");
    expect(await renameDonationNickname(extra.id, "응원대장")).toEqual({ status: "SAVED" });
    expect(await setDefaultDonationNickname(extra.id)).toEqual({ status: "SAVED" });
    expect((await removeDonationNickname("nk-default")).status).toBe("INVALID");
    expect(await removeDonationNickname(extra.id)).toEqual({ status: "SAVED" });
    id = (await getSupporterIdentity())!;
    expect(id.nicknames.find((n) => n.isDefault)?.id).toBe("nk-default");
  });

  it("attributes a donation to the chosen nickname and rejects someone else's nickname", async () => {
    const { addDonationNickname, getSupporterIdentity, requestDonation } = await load();
    await addDonationNickname("응원단장");
    const nick = (await getSupporterIdentity())!.nicknames.find((n) => n.name === "응원단장")!;
    expect((await requestDonation(text(1_000, 2, nick.id))).status).toBe("COMPLETED");
    expect((await requestDonation(text(1_000, 3, "nk-not-mine"))).status).toBe("INVALID");
    const id = (await getSupporterIdentity())!;
    expect(id.nicknames.find((n) => n.id === nick.id)).toMatchObject({ totalFn: 1_000, count: 1 });
  });

  it("only allows equipping a title that was earned", async () => {
    const { saveEquipSettings, requestDonation } = await load();
    await requestDonation(text(20_000, 4));
    expect(await saveEquipSettings({ showGrade: true, globalTitle: "BRONZE", showStoreTitle: true })).toEqual({ status: "SAVED" });
    expect((await saveEquipSettings({ showGrade: true, globalTitle: "LEGEND", showStoreTitle: true })).status).toBe("INVALID");
    expect((await saveEquipSettings({ showGrade: "yes", globalTitle: "AUTO", showStoreTitle: true })).status).toBe("INVALID");
  });

  it("requires a session", async () => {
    const { getSupporterIdentity, addDonationNickname } = await load();
    signIn(null);
    expect(await getSupporterIdentity()).toBeNull();
    expect((await addDonationNickname("응원단장")).status).toBe("UNAUTHORIZED");
  });
});
