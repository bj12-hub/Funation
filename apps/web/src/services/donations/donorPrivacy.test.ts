import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores } from "@/test/mockEnv";
import { DEFAULT_WIDGET_SETTINGS } from "@/services/creator/widgetSettingsTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** Who a donation shows and counts as on stream: 후원랭킹 keys, 별명, 대체 메시지 on the game overlays. */
async function load() {
  const { mockAccount } = await import("@/services/account/mockStore");
  mockAccount.fnBalance = 1_000_000;
  const creators = await import("@/services/creators/creators");
  const c1 = (await creators.getCreatorById("c1"))!;
  // Only the studio channel reaches the overlays in the mock.
  vi.spyOn(creators, "getCreatorById").mockResolvedValue({ ...c1, id: "studio" });
  const { requestDonation } = await import("./donate");
  const identity = await import("@/services/supporter/identity");
  const { mockAlerts } = await import("@/services/creator/alertCore");
  const { rankingRows } = await import("@/services/creator/widgetOverlayCore");
  const ranking = () => rankingRows(mockAlerts.items, { ...DEFAULT_WIDGET_SETTINGS.RANKING, period: "전체", ranks: 10 });
  return { requestDonation, identity, mockAlerts, ranking };
}

const text = (n: number, extra: Record<string, unknown> = {}) => ({ creatorId: "studio", hideProfile: false, type: "TEXT", amount: 1_000, message: "", voiceId: null, idempotencyKey: key(n), ...extra });

describe("후원랭킹 donor keys", () => {
  beforeEach(() => resetMockStores());

  it("never merges a copied name into another supporter's row, and keeps the member id off the overlay", async () => {
    const m = await load();
    // 별빛소나타 is #1 in the seeded history (70,000 FN); copying the name as an 별명 must not join that row.
    expect(await m.identity.addDonationNickname("별빛소나타")).toEqual({ status: "SAVED" });
    const alias = (await m.identity.getDonationNicknameOptions())!.find((n) => n.name === "별빛소나타")!;
    expect((await m.requestDonation(text(1, { nicknameId: alias.id }))).status).toBe("COMPLETED");
    const sent = m.mockAlerts.items.at(-1)!;
    expect(sent.donor).toBe("별빛소나타");
    expect(sent.donorKey).toMatch(/^dk-/);
    expect(JSON.stringify(sent)).not.toContain("u-test");
    expect(m.ranking().filter((r) => r.name === "별빛소나타").map((r) => r.fnAmount)).toEqual([70_000, 1_000]);

    // The same member under another name stays one row, shown with the latest name.
    await m.requestDonation(text(2));
    expect(m.mockAlerts.items.at(-1)!.donorKey).toBe(sent.donorKey);
    expect(m.ranking().find((r) => r.fnAmount === 2_000)).toMatchObject({ name: "홍길동" });

    // 프로필 숨기기: no key, never ranked.
    await m.requestDonation(text(3, { hideProfile: true, amount: 500_000 }));
    expect(m.mockAlerts.items.at(-1)).toMatchObject({ donor: "익명", donorKey: null });
    expect(m.ranking()[0].fnAmount).toBe(70_000);
  });

  it("reserves 익명 (the hidden-profile label) as an 별명", async () => {
    const m = await load();
    expect((await m.identity.addDonationNickname("익명")).status).toBe("INVALID");
    expect((await m.identity.addDonationNickname("응원단")).status).toBe("SAVED");
    const id = (await m.identity.getDonationNicknameOptions())!.find((n) => n.name === "응원단")!.id;
    expect((await m.identity.renameDonationNickname(id, "익명")).status).toBe("INVALID");
  });
});
