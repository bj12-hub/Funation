import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

/** `during` runs inside the next mock delay, i.e. while the server is "busy" between its checks. */
const delay = vi.hoisted(() => ({ during: null as null | (() => void) }));
vi.mock("@/lib/mock", () => ({
  USE_MOCK: true,
  mockDelay: async () => {
    const run = delay.during;
    delay.during = null;
    run?.();
  }
}));
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

  it("computes the 활동 등급, 누적 등급 and creator title from completed donations", async () => {
    const { getSupporterIdentity, requestDonation } = await load();
    await requestDonation(text(120_000, 1));
    let id = (await getSupporterIdentity())!;
    expect(id.grade).toMatchObject({ key: "PLATINUM", recentFn: 120_000, kept: false });
    expect(id.grade.progress).toMatchObject({ nextLabel: "마스터", nextMinFn: 200_000, percent: 20 });
    // 누적 등급 starts at 다이아: below it there is none yet.
    expect(id.global).toMatchObject({ lifetimeFn: 120_000, earned: [], best: null });
    expect(id.global.progress).toMatchObject({ nextLabel: "다이아", nextMinFn: 500_000 });
    expect(id.stores[0]).toMatchObject({ creatorId: "c1", totalFn: 120_000, title: "TRUE" });

    await requestDonation(text(380_000, 2));
    id = (await getSupporterIdentity())!;
    expect(id.grade.key).toBe("LEGEND");
    expect(id.global).toMatchObject({ lifetimeFn: 500_000, earned: ["DIAMOND"], best: "DIAMOND" });
    expect(id.global.progress).toMatchObject({ nextLabel: "블루 다이아", nextMinFn: 700_000, percent: 0 });
  });

  it("raises the 활동 등급 at once and lets it fall only when a month starts (지난 6개월 기준)", async () => {
    const { getSupporterIdentity, requestDonation } = await load();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const at = async (time: string) => {
        vi.setSystemTime(new Date(time));
        return (await getSupporterIdentity())!.grade;
      };
      vi.setSystemTime(new Date("2026-04-20T12:00:00"));
      expect((await requestDonation(text(60_000, 21))).status).toBe("COMPLETED");
      expect(await at("2026-09-30T23:59:00")).toMatchObject({ key: "GOLD", recentFn: 60_000, kept: false });
      // 10월 1일: 4월 has left this month and the five before, but 4월–9월 (the six full months before 10월) keep 골드.
      expect(await at("2026-10-01T00:00:00")).toMatchObject({ key: "GOLD", recentFn: 0, kept: true });

      expect((await requestDonation(text(20_000, 22))).status).toBe("COMPLETED");
      const kept = await at("2026-10-01T00:00:00");
      expect(kept).toMatchObject({ key: "GOLD", recentFn: 20_000, kept: true });
      // Progress counts from the kept 골드: still below it, so the bar is empty.
      expect(kept.progress).toMatchObject({ nextLabel: "플래티넘", nextMinFn: 100_000, percent: 0 });
      // Reaching a higher grade raises it in the same month.
      expect((await requestDonation(text(80_000, 23))).status).toBe("COMPLETED");
      expect(await at("2026-10-31T23:59:00")).toMatchObject({ key: "PLATINUM", recentFn: 100_000, kept: false });

      expect(await at("2027-03-31T23:59:00")).toMatchObject({ key: "PLATINUM", recentFn: 100_000, kept: false });
      expect(await at("2027-04-01T00:00:00")).toMatchObject({ key: "PLATINUM", recentFn: 0, kept: true });
      expect(await at("2027-05-01T00:00:00")).toMatchObject({ key: "BASIC", recentFn: 0, kept: false });
    } finally {
      vi.useRealTimers();
    }
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

  it("refuses an 별명 another member or a channel already uses (2026-10-08 결정), case-insensitively", async () => {
    const { addDonationNickname, renameDonationNickname, getSupporterIdentity } = await load();
    const taken = { status: "INVALID", message: "다른 회원이나 채널이 쓰는 이름은 별명으로 쓸 수 없어요." };
    expect(await addDonationNickname("새벽라디오")).toEqual(taken); // another member's nickname
    expect(await addDonationNickname(" 하루봄 ")).toEqual(taken); // a channel name
    expect(await addDonationNickname("SSUMNATION")).toEqual(taken);
    expect(await addDonationNickname("홍길동")).toEqual({ status: "INVALID", message: "이미 등록한 별명이에요." }); // own nickname
    expect(await addDonationNickname("익명")).toEqual({ status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." });
    expect(await addDonationNickname("응원단장")).toEqual({ status: "SAVED" });
    const extra = (await getSupporterIdentity())!.nicknames.find((n) => n.name === "응원단장")!;
    expect(await renameDonationNickname(extra.id, "불꽃크루")).toEqual(taken);
    expect(await renameDonationNickname(extra.id, "응원대장")).toEqual({ status: "SAVED" });
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

  it("keeps each donation under the 별명 it went out with; a removed 별명 merges into the 기본 별명", async () => {
    const { addDonationNickname, setDefaultDonationNickname, removeDonationNickname, getSupporterIdentity, requestDonation } = await load();
    await addDonationNickname("응원단장");
    await addDonationNickname("별빛요정");
    const named = async () => Object.fromEntries((await getSupporterIdentity())!.nicknames.map((n) => [n.name, n.totalFn]));
    const ids = (await getSupporterIdentity())!.nicknames;
    const cheer = ids.find((n) => n.name === "응원단장")!.id;
    const star = ids.find((n) => n.name === "별빛요정")!.id;

    await setDefaultDonationNickname(cheer);
    expect((await requestDonation(text(1_000, 11))).status).toBe("COMPLETED"); // no pick: goes out as the 대표 (응원단장)
    expect((await requestDonation(text(2_000, 12, star))).status).toBe("COMPLETED");
    // Another 대표 later does not move what was already sent.
    await setDefaultDonationNickname(star);
    expect(await named()).toEqual({ 홍길동: 0, 응원단장: 1_000, 별빛요정: 2_000 });

    // "삭제한 별명의 후원 기록은 기본 별명으로 합쳐져요" — not into whichever 별명 is the 대표 now.
    await setDefaultDonationNickname(cheer);
    await removeDonationNickname(star);
    expect(await named()).toEqual({ 홍길동: 2_000, 응원단장: 1_000 });
  });

  it("re-checks the 별명 after the wait, so a 별명 removed meanwhile never becomes the 대표", async () => {
    const { addDonationNickname, setDefaultDonationNickname, getSupporterIdentity, requestDonation } = await load();
    const { mockIdentity } = await import("./mockIdentityStore");
    await addDonationNickname("응원단장");
    const nick = (await getSupporterIdentity())!.nicknames.find((n) => n.name === "응원단장")!;
    // Another tab removes the 별명 while this request waits.
    delay.during = () => {
      mockIdentity.nicknames = mockIdentity.nicknames.filter((n) => n.id !== nick.id);
    };
    expect(await setDefaultDonationNickname(nick.id)).toEqual({ status: "INVALID", message: "별명을 찾을 수 없어요." });
    expect((await getSupporterIdentity())!.nicknames.find((n) => n.isDefault)?.id).toBe("nk-default");
    // The alert still resolves a name for a donation without a pick.
    expect((await requestDonation(text(1_000, 13))).status).toBe("COMPLETED");
  });

  it("gives every 별명 its own id, also when several are added in one millisecond", async () => {
    const { addDonationNickname, removeDonationNickname, renameDonationNickname, getSupporterIdentity } = await load();
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-08T12:00:00Z"));
    try {
      await addDonationNickname("응원단장");
      await addDonationNickname("별빛요정");
      const first = (await getSupporterIdentity())!.nicknames;
      await removeDonationNickname(first.find((n) => n.name === "응원단장")!.id);
      await addDonationNickname("달빛요정");
      const list = (await getSupporterIdentity())!.nicknames;
      expect(new Set(list.map((n) => n.id)).size).toBe(list.length);
      // Renaming the new one leaves the other alone.
      expect(await renameDonationNickname(list.find((n) => n.name === "달빛요정")!.id, "햇빛요정")).toEqual({ status: "SAVED" });
      expect((await getSupporterIdentity())!.nicknames.map((n) => n.name)).toEqual(["홍길동", "별빛요정", "햇빛요정"]);
    } finally {
      clock.mockRestore();
    }
  });

  it("only allows equipping a title that was earned", async () => {
    const { saveEquipSettings, requestDonation } = await load();
    await requestDonation(text(500_000, 4));
    expect(await saveEquipSettings({ showGrade: true, globalTitle: "DIAMOND", showStoreTitle: true })).toEqual({ status: "SAVED" });
    expect((await saveEquipSettings({ showGrade: true, globalTitle: "BLUE_DIAMOND", showStoreTitle: true })).status).toBe("INVALID");
    // A key of the old ladder is not a title any more.
    expect((await saveEquipSettings({ showGrade: true, globalTitle: "GOLD", showStoreTitle: true })).status).toBe("INVALID");
    expect((await saveEquipSettings({ showGrade: "yes", globalTitle: "AUTO", showStoreTitle: true })).status).toBe("INVALID");
  });

  it("previews exactly what the Donation Core puts on the alert: 별명, 등급·칭호, hidden profile", async () => {
    const { addDonationNickname, getAlertBadges, getSupporterIdentity, requestDonation } = await load();
    const { mockAlerts } = await import("@/services/creator/alertCore");
    const creators = await import("@/services/creators/creators");
    await requestDonation(text(500_000, 5));
    await addDonationNickname("응원단장");
    const nick = (await getSupporterIdentity())!.nicknames.find((n) => n.name === "응원단장")!;
    expect(await getAlertBadges(nick.id, "c1")).toEqual({ name: "응원단장", grade: "레전드", globalTitle: "다이아", storeTitle: "왕관 팬" });
    expect((await getAlertBadges(nick.id, "c2"))?.storeTitle).toBeNull();
    expect((await getAlertBadges("nk-not-mine", "c1"))?.name).not.toBe("nk-not-mine");

    // Only the studio channel has an overlay queue in mock mode.
    const c1 = (await creators.getCreatorById("c1"))!;
    vi.spyOn(creators, "getCreatorById").mockResolvedValue({ ...c1, id: "studio" });
    const preview = (await getAlertBadges(nick.id, "studio"))!;
    expect((await requestDonation({ ...text(1_000, 6, nick.id), creatorId: "studio" })).status).toBe("COMPLETED");
    expect(mockAlerts.items.at(-1)).toMatchObject({ kind: "DONATION", donor: "응원단장", badges: ["레전드", "다이아"] });
    expect(preview).toMatchObject({ name: "응원단장", grade: "레전드", globalTitle: "다이아", storeTitle: null });
    await requestDonation({ ...text(1_000, 7, nick.id), creatorId: "studio", hideProfile: true });
    expect(mockAlerts.items.at(-1)).toMatchObject({ donor: "익명", badges: [] });
  });

  it("requires a session", async () => {
    const { getSupporterIdentity, addDonationNickname, getAlertBadges } = await load();
    signIn(null);
    expect(await getSupporterIdentity()).toBeNull();
    expect((await addDonationNickname("응원단장")).status).toBe("UNAUTHORIZED");
    expect(await getAlertBadges(null, "c1")).toBeNull();
  });
});
