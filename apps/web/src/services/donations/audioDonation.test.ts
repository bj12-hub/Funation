import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * 음성 후원 (2026-10-08 결정: 유튜브 링크의 소리만): the 영상 후원 path with its own type — same link and range checks,
 * same debit and idempotency, queued with the videos and played as sound (small player) on the video overlay.
 */
async function load(balance = 50_000) {
  const { mockAccount } = await import("@/services/account/mockStore");
  const { mockWallet } = await import("@/services/wallet/mockWalletStore");
  const { requestDonation } = await import("./donate");
  const media = await import("@/services/creator/media");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  // The mock's room creators are c1…; the studio channel (the only one with overlays) stands in for one, as in donate.test.
  const creators = await import("@/services/creators/creators");
  const c1 = (await creators.getCreatorById("c1"))!;
  vi.spyOn(creators, "getCreatorById").mockResolvedValue({ ...c1, id: "studio" });
  mockAccount.fnBalance = balance;
  return { requestDonation, account: mockAccount, wallet: mockWallet, ...media, key: mockCreator.integrationKey };
}

const audio = (n: number, extra: Record<string, unknown> = {}) => ({
  creatorId: "studio",
  hideProfile: false,
  type: "AUDIO",
  amount: 1_000,
  videoUrl: "https://youtu.be/aaaaaaaaaaa",
  startSec: 5,
  endSec: 35,
  termsAgreed: true,
  idempotencyKey: key(n),
  ...extra
});

describe("음성 후원", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.restoreAllMocks());

  it("debits once, queues it as sound and plays it in the small player on the video overlay", async () => {
    const m = await load();
    const res = await m.requestDonation(audio(1));
    expect(res).toMatchObject({ status: "COMPLETED", fnAmount: 1_000, balance: 49_000 });
    // A retry with the same key never debits again or queues a second request.
    expect(await m.requestDonation(audio(1))).toEqual(res);
    expect(m.account.fnBalance).toBe(49_000);

    const queue = (await m.getVideoQueue())!;
    const all = [queue.playing, ...queue.waiting].filter(Boolean);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ kind: "DONATION", mode: "AUDIO", videoId: "aaaaaaaaaaa", startSec: 5, endSec: 35, fnAmount: 1_000 });

    const overlay = await m.getOverlayVideo(m.key);
    if (overlay === "FORBIDDEN") throw new Error("forbidden");
    if (overlay.playing) expect(overlay.playing).toMatchObject({ mode: "AUDIO", videoId: "aaaaaaaaaaa" });
  });

  it("checks the link, range, minimum and terms like 영상 후원, before any debit", async () => {
    const m = await load();
    expect(await m.requestDonation(audio(1, { videoUrl: "https://example.com/song.mp3" }))).toEqual({ status: "INVALID" });
    expect(await m.requestDonation(audio(2, { startSec: 40, endSec: 10 }))).toEqual({ status: "INVALID" });
    expect(await m.requestDonation(audio(3, { endSec: 86_401 }))).toEqual({ status: "INVALID" });
    expect(await m.requestDonation(audio(4, { amount: 999 }))).toEqual({ status: "INVALID" });
    expect(await m.requestDonation(audio(5, { termsAgreed: false }))).toEqual({ status: "INVALID" });
    expect(m.account.fnBalance).toBe(50_000);
    expect(m.wallet.donations).toHaveLength(0);
  });

  it("keeps 영상 후원 as video and lets a 테스트 request choose 음성", async () => {
    const m = await load();
    expect(await m.requestDonation({ ...audio(1), type: "VIDEO" })).toMatchObject({ status: "COMPLETED" });
    expect(await m.addTestVideo({ requestId: key(50), url: "https://youtu.be/bbbbbbbbbbb", startSec: 0, endSec: 10, mode: "AUDIO" })).toEqual({ status: "OK" });
    expect(await m.addTestVideo({ requestId: key(51), url: "https://youtu.be/bbbbbbbbbbb", startSec: 0, endSec: 10, mode: "LOUD" })).toMatchObject({ status: "INVALID" });
    const queue = (await m.getVideoQueue())!;
    const all = [queue.playing, ...queue.waiting].filter(Boolean);
    expect(all.map((v) => [v!.kind, v!.mode])).toEqual([
      ["DONATION", "VIDEO"],
      ["TEST", "AUDIO"]
    ]);
  });
});
