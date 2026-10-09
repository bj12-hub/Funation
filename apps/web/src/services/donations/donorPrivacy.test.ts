import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signInAs } from "@/test/mockEnv";
import { DEFAULT_WIDGET_SETTINGS } from "@/services/creator/widgetSettingsTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** Who a donation shows and counts as on stream: 후원랭킹 keys, 별명, 대체 메시지 on the game overlays. */
async function load(studio = true) {
  const { mockAccount } = await import("@/services/account/mockStore");
  mockAccount.fnBalance = 1_000_000;
  const creators = await import("@/services/creators/creators");
  const c1 = (await creators.getCreatorById("c1"))!;
  // Only the studio channel reaches the alert overlays in the mock.
  if (studio) vi.spyOn(creators, "getCreatorById").mockResolvedValue({ ...c1, id: "studio" });
  const { requestDonation } = await import("./donate");
  const identity = await import("@/services/supporter/identity");
  const { mockAlerts } = await import("@/services/creator/alertCore");
  const { rankingRows } = await import("@/services/creator/widgetOverlayCore");
  const ranking = () => rankingRows(mockAlerts.items, { ...DEFAULT_WIDGET_SETTINGS.RANKING, period: "전체", ranks: 10 });
  return { requestDonation, identity, mockAlerts, ranking };
}

const text = (n: number, extra: Record<string, unknown> = {}) => ({ creatorId: "studio", hideProfile: false, type: "TEXT", amount: 1_000, message: "", voiceId: null, idempotencyKey: key(n), ...extra });

describe("룰렛 · 뽑기 overlays", () => {
  beforeEach(() => resetMockStores());

  it("show the donor name after the creator's 대체 메시지 rules, while the records keep the original", async () => {
    const m = await load(false);
    const { donationPageStore } = await import("@/services/creator/donationPageCore");
    const roulette = await import("./rouletteCore");
    const gacha = await import("./gachaCore");
    donationPageStore.replacement = { applyToNickname: true, applyToText: false, bannedWords: ["길동"], message: "응원 고마워요" };

    const spin = { creatorId: "c1", hideProfile: false, type: "ROULETTE", amount: 10_000, idempotencyKey: key(1) };
    expect((await m.requestDonation(spin)).status).toBe("COMPLETED");
    const record = roulette.mockRoulette.spins.at(-1)!;
    expect(record.donor).toBe("홍길동");
    roulette.startSpin(record); // 자동 시작 is off by default
    expect(roulette.stageOf("c1")).toMatchObject({ donor: "응원 고마워요" });

    const draw = { creatorId: "c1", hideProfile: false, type: "GACHA", gachaId: "gacha-1", termsAgreed: true, expectedAmount: 3_000, idempotencyKey: key(2) };
    expect((await m.requestDonation(draw)).status).toBe("COMPLETED");
    const stage = gacha.stageOf("c1")!;
    expect(stage.donor).toBe("응원 고마워요");
    expect(stage.message).toContain("응원 고마워요");
    expect(stage.message).not.toContain("길동");
    expect(gacha.mockGacha.draws.at(-1)!.donor).toBe("홍길동");
    const later = Date.now() + 60_000;
    expect(gacha.boardOf("c1", later).rows.every((r) => !r.donor.includes("길동"))).toBe(true);
  });
});

describe("idempotency keys", () => {
  beforeEach(() => resetMockStores());

  it("belong to the member: another member's key never returns their result", async () => {
    const m = await load(false);
    const sent = { creatorId: "c1", hideProfile: false, type: "TEXT", amount: 1_000, message: "", voiceId: null, idempotencyKey: key(1) };
    const mine = await m.requestDonation(sent);
    expect(await m.requestDonation(sent)).toEqual(mine);
    signInAs("u-other");
    const theirs = await m.requestDonation({ ...sent, amount: 2_000 }); // not a CONFLICT with the other member's request
    expect(theirs).toMatchObject({ status: "COMPLETED", fnAmount: 2_000 });
    expect(theirs.status === "COMPLETED" && mine.status === "COMPLETED" && theirs.donationId !== mine.donationId).toBe(true);
  });
});

describe("후원 닉네임 변경", () => {
  beforeEach(() => resetMockStores());

  it("sends every donation under the member nickname while the creator has it off", async () => {
    const m = await load();
    const { donationPageStore } = await import("@/services/creator/donationPageCore");
    expect(await m.identity.addDonationNickname("응원단장")).toEqual({ status: "SAVED" });
    const alias = (await m.identity.getDonationNicknameOptions())!.find((n) => n.name === "응원단장")!;
    await m.identity.setDefaultDonationNickname(alias.id);
    donationPageStore.options.nicknameChangeable = false;
    const aliasTotal = async () => (await m.identity.getSupporterIdentity())!.nicknames.find((n) => n.id === alias.id)!.totalFn;
    const before = await aliasTotal();

    expect(await m.identity.getDonationNicknameOptions()).toEqual([{ id: "nk-default", name: "홍길동" }]);
    expect((await m.identity.getAlertBadges(alias.id, "studio"))!.name).toBe("홍길동");
    expect((await m.requestDonation(text(1, { nicknameId: alias.id }))).status).toBe("COMPLETED");
    expect(m.mockAlerts.items.at(-1)!.donor).toBe("홍길동");
    expect((await m.requestDonation(text(2))).status).toBe("COMPLETED"); // the 별명 set as default is not used either
    expect(m.mockAlerts.items.at(-1)!.donor).toBe("홍길동");
    expect(await aliasTotal()).toBe(before); // counted under the member nickname, not the 별명

    donationPageStore.options.nicknameChangeable = true;
    await m.requestDonation(text(3, { nicknameId: alias.id }));
    expect(m.mockAlerts.items.at(-1)!.donor).toBe("응원단장");
  });
});

describe("후원랭킹 donor keys", () => {
  beforeEach(() => resetMockStores());

  it("never merges a copied name into another supporter's row, and keeps the member id off the overlay", async () => {
    const m = await load();
    // 별빛소나타 is #1 in the seeded history (70,000 FN) and no member's nickname, so another supporter can take it as
    // an 별명 (별명 are not unique across members); their donation must not join that row.
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

  it("keeps the key of a name 후원 필터링 turned into 익명 off the ranking", async () => {
    const m = await load();
    const { donationPageStore } = await import("@/services/creator/donationPageCore");
    donationPageStore.replacement = { applyToNickname: true, applyToText: false, bannedWords: ["길동"], message: "" };
    await m.requestDonation(text(1, { amount: 500_000 }));
    expect(m.mockAlerts.items.at(-1)).toMatchObject({ donor: "익명", donorKey: expect.stringMatching(/^dk-/) });
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

describe("익명 후원과 크리에이터 칭호 (2026-10-09 결정)", () => {
  beforeEach(() => resetMockStores());

  it("counts a donation sent as 익명 toward the 누적 · 활동 등급 but not toward the 크리에이터 칭호", async () => {
    const m = await load();
    (await import("@/services/account/mockStore")).mockAccount.fnBalance = 2_000_000;
    const studio = (id: { stores: { creatorId: string; totalFn: number }[] }) => id.stores.find((s) => s.creatorId === "studio")?.totalFn ?? 0;
    const before = (await m.identity.getSupporterIdentity())!;
    expect((await m.requestDonation(text(1, { hideProfile: true, amount: 500_000 }))).status).toBe("COMPLETED");
    const after = (await m.identity.getSupporterIdentity())!;
    expect(after.global.lifetimeFn).toBe(before.global.lifetimeFn + 500_000);
    expect(after.grade.recentFn).toBe(before.grade.recentFn + 500_000);
    expect(studio(after)).toBe(studio(before));
    // The next donation's alert and preview: no 왕관 팬 from the hidden one.
    expect((await m.identity.getAlertBadges(null, "studio"))!.storeTitle).toBeNull();
    await m.requestDonation(text(2));
    expect(m.mockAlerts.items.at(-1)!.badges).not.toContain("왕관 팬");
    // The same amount sent with the profile shown earns it.
    await m.requestDonation(text(3, { amount: 500_000 }));
    expect((await m.identity.getSupporterIdentity())!.stores.find((s) => s.creatorId === "studio")).toMatchObject({ totalFn: 501_000, title: "CROWN" });
  });
});

describe("대체된 닉네임의 배지 (2026-10-09 결정)", () => {
  beforeEach(() => resetMockStores());

  it("sends a name the 대체 메시지 rules hide without its 등급 · 칭호 badges, on the OBS overlay too", async () => {
    const m = await load();
    const { donationPageStore } = await import("@/services/creator/donationPageCore");
    const { getOverlayAlert } = await import("@/services/creator/alertRemote");
    const { mockCreator } = await import("@/services/creator/mockCreatorStore");
    // Badges earned with the name shown as it is (활동 등급, 크리에이터 칭호 왕관 팬).
    await m.requestDonation(text(1, { amount: 500_000 }));
    await m.requestDonation(text(2));
    expect(m.mockAlerts.items.at(-1)).toMatchObject({ donor: "홍길동", badges: expect.arrayContaining(["왕관 팬"]) });

    // 닉네임 금지어 with an empty 대체 메시지: 익명, without badges; the opaque key stays.
    for (const a of m.mockAlerts.items) a.status = "DONE";
    m.mockAlerts.shownAt = null;
    donationPageStore.replacement = { applyToNickname: true, applyToText: false, bannedWords: ["길동"], message: "" };
    await m.requestDonation(text(3));
    expect(m.mockAlerts.items.at(-1)).toMatchObject({ donor: "익명", badges: [], donorKey: expect.stringMatching(/^dk-/) });
    const overlay = await getOverlayAlert(mockCreator.integrationKey);
    expect(overlay !== "FORBIDDEN" && overlay.alert).toMatchObject({ donor: "익명", badges: [] });

    // Replaced by the 대체 메시지: still no badges.
    donationPageStore.replacement.message = "응원 고마워요";
    await m.requestDonation(text(4));
    expect(m.mockAlerts.items.at(-1)).toMatchObject({ donor: "응원 고마워요", badges: [] });
    // A name the rules leave alone keeps them.
    donationPageStore.replacement.bannedWords = ["클리어"];
    await m.requestDonation(text(5));
    expect(m.mockAlerts.items.at(-1)).toMatchObject({ donor: "홍길동", badges: expect.arrayContaining(["왕관 팬"]) });
  });
});

describe("대체된 닉네임과 후원랭킹 (2026-10-09 결정)", () => {
  beforeEach(() => resetMockStores());

  it("leaves every alert whose name the 대체 메시지 rules replaced out of the 후원랭킹, as decided when it was sent", async () => {
    const m = await load();
    const { donationPageStore } = await import("@/services/creator/donationPageCore");
    const { getOverlayWidget } = await import("@/services/creator/widgetOverlay");
    const { mockCreator } = await import("@/services/creator/mockCreatorStore");
    const names = () => m.ranking().map((r) => [r.name, r.fnAmount]);
    // The seeded history: 별빛소나타 70,000 · 우주비행사 30,000 · 치즈냥 10,000 · 초코쿠키 3,000 (익명 left out).
    const seeded = names();

    // Before any 금지어 matches the name: the donor's own row.
    await m.requestDonation(text(1, { amount: 2_000 }));
    expect(m.mockAlerts.items.at(-1)).not.toHaveProperty("nameReplaced");
    expect(names()).toEqual([...seeded, ["홍길동", 2_000]]);

    // Replaced by the 대체 메시지: it neither joins nor renames that row (same donor key), nor gets a row of its own.
    donationPageStore.replacement = { applyToNickname: true, applyToText: false, bannedWords: ["길동"], message: "응원 고마워요" };
    await m.requestDonation(text(2, { amount: 500_000 }));
    const replaced = m.mockAlerts.items.at(-1)!;
    expect(replaced).toMatchObject({ donor: "응원 고마워요", nameReplaced: true, donorKey: m.mockAlerts.items.at(-2)!.donorKey });
    expect(names()).toEqual([...seeded, ["홍길동", 2_000]]);

    // Replaced by 익명 (empty 대체 메시지): out as well.
    donationPageStore.replacement.message = "";
    await m.requestDonation(text(3, { amount: 300_000 }));
    expect(m.mockAlerts.items.at(-1)).toMatchObject({ donor: "익명", nameReplaced: true });
    expect(names()).toEqual([...seeded, ["홍길동", 2_000]]);

    // The OBS 후원랭킹 overlay reads the same rows.
    const overlay = await getOverlayWidget("ranking", mockCreator.integrationKey);
    if (overlay === "FORBIDDEN" || overlay.widget !== "ranking") throw new Error("ranking overlay");
    expect(overlay.rows.map((r) => r.name)).not.toContain("응원 고마워요");
    expect(overlay.rows.map((r) => r.fnAmount)).not.toContain(502_000);

    // Lifting the 금지어 later does not bring the replaced alerts back; the next donation counts as usual.
    donationPageStore.replacement.bannedWords = ["클리어"];
    expect(names()).toEqual([...seeded, ["홍길동", 2_000]]);
    await m.requestDonation(text(4, { amount: 1_000 }));
    expect(names()).toEqual([...seeded, ["홍길동", 3_000]]);
  });
});

describe("익명 후원과 별명 누적 (2026-10-09 결정)", () => {
  beforeEach(() => resetMockStores());

  it("keeps a donation sent as 익명 out of every 별명's totals, while the 누적 · 활동 등급 still count it", async () => {
    const m = await load();
    expect(await m.identity.addDonationNickname("응원단장")).toEqual({ status: "SAVED" });
    const alias = (await m.identity.getDonationNicknameOptions())!.find((n) => n.name === "응원단장")!;
    const identity = async () => (await m.identity.getSupporterIdentity())!;
    const totals = async () => Object.fromEntries((await identity()).nicknames.map((n) => [n.id, [n.totalFn, n.count]]));
    const before = await identity();
    const beforeTotals = await totals();

    // Hidden under a picked 별명, and hidden with none picked (the 기본 별명 would get an unattributed one).
    expect((await m.requestDonation(text(1, { hideProfile: true, nicknameId: alias.id, amount: 5_000 }))).status).toBe("COMPLETED");
    expect((await m.requestDonation(text(2, { hideProfile: true, amount: 7_000 }))).status).toBe("COMPLETED");
    expect(await totals()).toEqual(beforeTotals);
    const after = await identity();
    expect(after.global.lifetimeFn).toBe(before.global.lifetimeFn + 12_000);
    expect(after.grade.recentFn).toBe(before.grade.recentFn + 12_000);

    // Shown: it counts for the 별명 it went out under.
    await m.requestDonation(text(3, { nicknameId: alias.id, amount: 1_000 }));
    expect((await totals())[alias.id]).toEqual([1_000, 1]);
    // With that 별명 as 대표, a hidden donation still counts for none of them.
    expect(await m.identity.setDefaultDonationNickname(alias.id)).toEqual({ status: "SAVED" });
    await m.requestDonation(text(4, { hideProfile: true, amount: 2_000 }));
    expect((await totals())[alias.id]).toEqual([1_000, 1]);
    expect((await totals())["nk-default"]).toEqual(beforeTotals["nk-default"]);
  });
});
