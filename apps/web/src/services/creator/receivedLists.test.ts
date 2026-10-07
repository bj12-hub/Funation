import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

const wide = { from: "2000-01-01", to: "2099-12-31" };
const range = { preset: "range" as const, ...wide };

async function load() {
  const { mockAccount } = await import("@/services/account/mockStore");
  const m = await import("./donationManagement");
  const { requestDonation } = await import("@/services/donations/donate");
  const { crewDonationRows } = await import("@/services/crew/crewCore");
  mockAccount.fnBalance = 100_000;
  return { ...m, requestDonation, crewDonationRows };
}

const memberDonation = (n: number, creatorId: string, memberId: string | null, hideProfile = false) => ({
  creatorId,
  hideProfile,
  type: "TEXT",
  amount: 2_000,
  message: `멤버 응원 ${n}`,
  voiceId: null,
  memberId,
  idempotencyKey: key(n)
});

/** 받은 후원 "게임 후원" · "크루 후원" (code-first): same table, the last column is the game or the member. */
describe("받은 후원 요약", () => {
  it("counts only received FN — held quests apart, refunded ones out; 이번 주 starts on Monday", async () => {
    const { receivedStats } = await import("./donationManagementTypes");
    const now = new Date(2026, 9, 7, 15, 0); // Wed 2026-10-07
    const at = (d: number, h = 12) => new Date(2026, 9, d, h).toISOString();
    const rows = [
      { receivedAt: at(7), amount: 10_000, status: "SUCCESS" as const }, // today
      { receivedAt: at(5), amount: 5_000, status: "SUCCESS" as const }, // Mon, this week
      { receivedAt: at(7, 10), amount: 20_000, status: "IN_PROGRESS" as const }, // held, not received yet
      { receivedAt: at(4), amount: 3_000, status: null }, // Sun, last week
      { receivedAt: at(7, 9), amount: 50_000, status: "FAILED" as const }, // refunded
      { receivedAt: at(6), amount: 70_000, status: "CANCELED" as const } // refunded
    ];
    expect(receivedStats(rows, now)).toEqual({ totalFn: 18_000, count: 3, todayFn: 10_000, weekFn: 15_000, averageFn: 6_000, heldFn: 20_000, heldCount: 1 });
    expect(receivedStats([], now)).toEqual({ totalFn: 0, count: 0, todayFn: 0, weekFn: 0, averageFn: 0, heldFn: 0, heldCount: 0 });
  });

  it("counts a 성공 quest on the day it succeeded, in the period filter, 연도 and the CSV (2026-10-08 결정)", async () => {
    resetMockStores();
    const m = await load();
    const { mockQuests, decideQuest } = await import("@/services/donations/questCore");
    const q = mockQuests.items.find((x) => x.status === "IN_PROGRESS")!;
    q.createdAt = new Date(2025, 11, 31, 22).toISOString(); // sent 2025-12-31
    decideQuest(q, "SUCCESS", "CREATOR", new Date(2026, 0, 2, 10)); // succeeded 2026-01-02
    const ids = async (from: string, to: string) =>
      (await m.getReceivedDonations({ kind: "quest", period: { preset: "range", from, to }, status: "ALL", query: "", page: 1 }))!.items.map((d) => d.id);
    expect(await ids("2026-01-02", "2026-01-02")).toContain(q.id);
    expect(await ids("2025-12-31", "2025-12-31")).not.toContain(q.id);
    const page = (await m.getReceivedDonations({ kind: "quest", period: { preset: "range", from: "2026-01-02", to: "2026-01-02" }, status: "SUCCESS", query: "", page: 1 }))!;
    expect(page.items.find((d) => d.id === q.id)).toMatchObject({ at: q.createdAt, receivedAt: q.decidedAt });
    expect(page.stats.totalFn).toBeGreaterThanOrEqual(q.amount);
    expect(page.years).toContain(2026);

    const csv = await m.exportReceivedDonationsCsv({ kind: "quest", period: { from: "2026-01-02", to: "2026-01-02" }, status: "ALL", query: "" });
    if (csv.status !== "OK") throw new Error(csv.status);
    const [header, ...lines] = csv.csv.replace(/^\uFEFF/, "").split("\r\n");
    expect(header).toBe('"후원일시","후원자 닉네임","후원자 아이디","금액(FN)","메시지","성공일시","상태"');
    expect(lines.find((l) => l.startsWith(`"${q.createdAt}"`))).toContain(`"${q.decidedAt}","성공"`);
  });

  it("is part of every list page and covers all pages", async () => {
    const m = await load();
    const page1 = (await m.getReceivedDonations({ kind: "game", period: range, status: "ALL", query: "", page: 1 }))!;
    expect(page1.stats.count).toBe(page1.total);
    expect(page1.stats.totalFn).toBeGreaterThan(0);
  });
});

describe("받은 후원 게임 · 크루 목록", () => {
  beforeEach(() => resetMockStores());

  it("lists game donations by game type and ignores the quest-only 상태 filter", async () => {
    const m = await load();
    const all = (await m.getReceivedDonations({ kind: "game", period: range, status: "ALL", query: "", page: 1 }))!;
    expect(all.total).toBeGreaterThan(0);
    expect(all.items.every((d) => d.status === null && ["룰렛 후원", "뽑기 후원"].includes(d.detail!))).toBe(true);
    const filtered = (await m.getReceivedDonations({ kind: "game", period: range, status: "FAILED", query: "", page: 1 }))!;
    expect(filtered).toMatchObject({ status: "ALL", total: all.total });
    const csv = await m.exportReceivedDonationsCsv({ kind: "game", period: wide, status: "ALL", query: "" });
    if (csv.status !== "OK") throw new Error(csv.status);
    expect(csv.csv.split("\r\n")[0].endsWith('"게임 종류"')).toBe(true);
    expect(csv.rows).toBe(all.total);
  });

  it("lists donations sent for a crew member, newest first, without the id of a hidden profile", async () => {
    const m = await load();
    // The studio crew (mock seeds): every row names its member; a hidden profile has no id.
    const list = (await m.getReceivedDonations({ kind: "crew", period: range, status: "ALL", query: "", page: 1 }))!;
    expect(list.items.length).toBeGreaterThan(0);
    expect(list.items.every((d) => d.status === null && ["길동", "하늘", "바다", "솔"].includes(d.detail!))).toBe(true);
    expect(list.items.map((d) => d.at)).toEqual([...list.items.map((d) => d.at)].sort().reverse());
    expect(list.items.filter((d) => d.donorNickname === "익명").every((d) => d.donorId === "")).toBe(true);
    const csv = await m.exportReceivedDonationsCsv({ kind: "crew", period: wide, status: "ALL", query: "star" });
    if (csv.status !== "OK") throw new Error(csv.status);
    expect(csv.csv.split("\r\n")[0].endsWith('"멤버"')).toBe(true);
    expect(csv.csv.split("\r\n").slice(1)).toEqual([expect.stringContaining('"하늘"')]);

    // A completed member donation records who sent it (the c4 room crew).
    expect((await m.requestDonation(memberDonation(1, "c4", "cm-c4-3"))).status).toBe("COMPLETED");
    expect((await m.requestDonation(memberDonation(2, "c4", "cm-c4-3", true))).status).toBe("COMPLETED");
    expect((await m.requestDonation(memberDonation(3, "c4", null))).status).toBe("COMPLETED"); // no member → not listed
    const rows = m.crewDonationRows("c4");
    expect(rows.map((r) => [r.donor, r.donorId, r.message, r.member])).toEqual(
      expect.arrayContaining([
        ["홍길동", "hongGD123", "멤버 응원 1", "민수"],
        ["익명", "", "멤버 응원 2", "민수"]
      ])
    );
    expect(rows).toHaveLength(2);
  });
});
