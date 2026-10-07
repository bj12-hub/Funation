import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * 자동엑셀 (code-first): one 후원 리스트 for FN and platform donations, 원화 환산 with values the
 * creator enters, 배수 규칙 and 수기 기여도. The rates below are test inputs, not product rates (TBD).
 */
async function startLive() {
  const bc = await import("./crewBroadcast");
  const feed = await import("./crewFeed");
  const core = await import("./crewCore");
  await feed.setMemberKeywords({ memberId: "cm-s1", keywords: ["길동"] });
  await feed.setMemberKeywords({ memberId: "cm-s2", keywords: ["하늘"] });
  expect(await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "엑셀 방송", teamMode: false })).toEqual({ status: "SAVED" });
  const id = (await bc.getBroadcastView())!.live!.id;
  const view = async () => (await bc.getBroadcastView())!;
  return { ...bc, ...feed, ...core, id, view };
}

const score = (v: { live: { rows: { memberId: string; score: number }[] } | null }, memberId: string) => v.live!.rows.find((r) => r.memberId === memberId)!.score;

describe("자동엑셀", () => {
  beforeEach(() => resetMockStores());

  it("FN 기준 keeps the old scoreboard; 원화 환산 converts every unit with the creator's values", async () => {
    const { simulateDonation, setExcelSettings, view, id } = await startLive();
    await simulateDonation({ broadcastId: id, requestId: key(1), amount: 10_000, unit: "FN", message: "길동" });
    await simulateDonation({ broadcastId: id, requestId: key(2), amount: 100, unit: "별풍선", message: "하늘" });
    let v = await view();
    expect(v.feed!.excel).toEqual({ unit: "FN", rates: {}, rules: [] });
    expect(v.feed!.entries[0]).toMatchObject({ unit: "별풍선", platform: "SOOP", base: null, points: 0 });
    expect(score(v, "cm-s1")).toBe(10_000);

    // 원화 기준 without values: only 원 counts, nothing is guessed.
    await setExcelSettings({ unit: "KRW", rates: {}, rules: [] });
    v = await view();
    expect(score(v, "cm-s1")).toBe(0);
    expect(score(v, "cm-s2")).toBe(0);

    await setExcelSettings({ unit: "KRW", rates: { FN: 1, 별풍선: 100 }, rules: [] });
    v = await view();
    expect(score(v, "cm-s1")).toBe(10_000);
    expect(score(v, "cm-s2")).toBe(10_000);
    expect(v.feed!.entries[0]).toMatchObject({ base: 10_000, multiplier: 1, points: 10_000 });
  });

  it("multiplies in whole hundredths, so ×1.15 on 50 is 58 on every board", async () => {
    const { simulateDonation, setExcelSettings, attributeMemberDonation, view, id } = await startLive();
    const battle = await import("./crewBattle");
    // 50 × 1.15 is 57.49999… in floating point.
    await setExcelSettings({ unit: "FN", rates: {}, rules: [{ min: 1, multiplier: 1.15 }] });
    await simulateDonation({ broadcastId: id, requestId: key(1), amount: 50, unit: "FN", message: "길동" });
    attributeMemberDonation("dn-r1", "studio", "cm-s3", 50); // a member-targeted donation (바다)
    let v = await view();
    expect(v.feed!.entries[0]).toMatchObject({ multiplier: 1.15, points: 58 });
    expect(score(v, "cm-s1")).toBe(58);
    expect(score(v, "cm-s3")).toBe(58);

    await setExcelSettings({ unit: "FN", rates: {}, rules: [] });
    await battle.startBattle({ broadcastId: id, requestId: key(2), mode: "MEMBERS", memberA: "cm-s1", memberB: "cm-s2", durationSec: 300, multiplier: 1.15 });
    await simulateDonation({ broadcastId: id, requestId: key(3), amount: 50, unit: "FN", message: "하늘" });
    v = await view();
    expect(v.live!.battles[0].sides[1].score).toBe(58); // battle board
    expect(score(v, "cm-s2")).toBe(58); // main scoreboard: 50 + 배틀 배수 8
  });

  it("applies the highest matching 배수 규칙, and 수기 기여도 wins over it", async () => {
    const { simulateDonation, setExcelSettings, setEntryContribution, view, id } = await startLive();
    await setExcelSettings({ unit: "KRW", rates: { 별풍선: 100 }, rules: [{ min: 50_000, multiplier: 3 }, { min: 10_000, multiplier: 1.5 }] });
    await simulateDonation({ broadcastId: id, requestId: key(1), amount: 600, unit: "별풍선", message: "하늘" }); // 60,000원 → ×3
    await simulateDonation({ broadcastId: id, requestId: key(2), amount: 20_000, unit: "KRW", message: "하늘" }); // ×1.5
    let v = await view();
    expect(v.feed!.excel.rules.map((r) => r.min)).toEqual([10_000, 50_000]);
    expect(v.feed!.entries.map((e) => e.points)).toEqual([30_000, 180_000]);
    expect(score(v, "cm-s2")).toBe(210_000);

    const big = v.feed!.entries[1];
    await setEntryContribution({ broadcastId: id, entryId: big.id, contribution: { kind: "POINTS", value: 1_000 } });
    v = await view();
    expect(score(v, "cm-s2")).toBe(31_000);
    await setEntryContribution({ broadcastId: id, entryId: big.id, contribution: { kind: "MULTIPLIER", value: 2 } });
    v = await view();
    expect(v.feed!.entries[1]).toMatchObject({ multiplier: 2, points: 120_000 });
    await setEntryContribution({ broadcastId: id, entryId: big.id, contribution: null });
    v = await view();
    expect(v.feed!.entries[1].points).toBe(180_000);
  });

  it("sums 기여도 per platform and BJ, and lists platform donations from 후원 연동 in their own unit", async () => {
    const { simulateDonation, setExcelSettings, recordBroadcastExternal, recordBroadcastDonation, view, id } = await startLive();
    await setExcelSettings({ unit: "KRW", rates: { FN: 1, 치즈: 1 }, rules: [] });
    await simulateDonation({ broadcastId: id, requestId: key(1), amount: 5_000, unit: "KRW", message: "길동" });
    recordBroadcastExternal("studio", { platform: "CHZZK", donor: "치즈러버", message: "길동 화이팅", value: 3_000, currency: "치즈" });
    recordBroadcastExternal("studio", { platform: "YOUTUBE", donor: "x", message: "길동", value: 5, currency: "EUR" }); // unknown unit: not listed
    recordBroadcastDonation("studio", { donor: "홍길동", message: "그냥", fnAmount: 2_000 });
    const v = await view();
    expect(v.feed!.entries).toHaveLength(3);
    const gil = v.feed!.summary.find((r) => r.memberId === "cm-s1")!;
    expect(gil).toMatchObject({ points: { YOUTUBE: 5_000, CHZZK: 3_000 }, total: 8_000 });
    expect(v.feed!.summary.at(-1)).toMatchObject({ memberId: null, points: { SOMNATION: 2_000 }, total: 2_000 });
    expect(score(v, "cm-s1")).toBe(8_000);
  });

  it("validates settings and 기여도, and requires a creator session", async () => {
    const { setExcelSettings, setEntryContribution, simulateDonation, cancelFeedEntry, view, id } = await startLive();
    expect((await setExcelSettings({ unit: "KRW", rates: { KRW: 2 }, rules: [] })).status).toBe("INVALID");
    expect((await setExcelSettings({ unit: "KRW", rates: { 별풍선: -1 }, rules: [] })).status).toBe("INVALID");
    expect((await setExcelSettings({ unit: "KRW", rates: {}, rules: [{ min: 1, multiplier: 101 }] })).status).toBe("INVALID");
    expect((await setExcelSettings({ unit: "KRW", rates: {}, rules: [{ min: 1, multiplier: 2 }, { min: 1, multiplier: 3 }] })).status).toBe("INVALID");
    const six = Array.from({ length: 6 }, (_, i) => ({ min: i + 1, multiplier: 2 }));
    expect((await setExcelSettings({ unit: "KRW", rates: {}, rules: six })).status).toBe("INVALID");
    expect((await simulateDonation({ broadcastId: id, requestId: key(1), amount: 1.5, unit: "별풍선" })).status).toBe("INVALID");
    expect((await simulateDonation({ broadcastId: id, requestId: key(2), amount: 1.25, unit: "USD" })).status).toBe("SAVED");

    const entry = (await view()).feed!.entries[0];
    expect((await setEntryContribution({ broadcastId: id, entryId: entry.id, contribution: { kind: "POINTS", value: 1.5 } })).status).toBe("INVALID");
    await cancelFeedEntry({ broadcastId: id, entryId: entry.id });
    expect((await setEntryContribution({ broadcastId: id, entryId: entry.id, contribution: null })).status).toBe("INVALID");

    signIn(["SUPPORTER"]);
    expect(await setExcelSettings({ unit: "FN", rates: {}, rules: [] })).toEqual({ status: "UNAUTHORIZED" });
  });
});
