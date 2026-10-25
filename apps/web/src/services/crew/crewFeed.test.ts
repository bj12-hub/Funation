import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 후원 리스트 (code-first): keyword assignment, 확인 후 mode, 한방, 취소, 프로젝트 · 회차. */
async function load() {
  const bc = await import("./crewBroadcast");
  const feed = await import("./crewFeed");
  const core = await import("./crewCore");
  return { ...bc, ...feed, ...core };
}

async function startLive(project = "") {
  const m = await load();
  await m.setMemberKeywords({ memberId: "cm-s1", keywords: ["길동", "gd"] });
  await m.setMemberKeywords({ memberId: "cm-s2", keywords: ["하늘"] });
  expect(await m.startBroadcast({ requestId: crypto.randomUUID(), title: "테스트 방송", project, teamMode: false })).toEqual({ status: "SAVED" });
  const view = (await m.getBroadcastView())!;
  return { ...m, id: view.live!.id };
}

const score = (view: { live: { rows: { memberId: string; score: number }[] } | null }, memberId: string) =>
  view.live!.rows.find((r) => r.memberId === memberId)!.score;

describe("후원 리스트", () => {
  beforeEach(() => resetMockStores());

  it("assigns by keyword in 자동 mode and leaves ambiguous or unmatched entries 미지정", async () => {
    const { simulateDonation, getBroadcastView, assignFeedEntry, id } = await startLive();
    await simulateDonation({ broadcastId: id, requestId: key(1), amount: 10_000, message: "GD 화이팅" });
    await simulateDonation({ broadcastId: id, requestId: key(1), amount: 10_000, message: "GD 화이팅" }); // same request → once
    await simulateDonation({ broadcastId: id, requestId: key(2), amount: 5_000, message: "길동 하늘 둘 다" });
    await simulateDonation({ broadcastId: id, requestId: key(3), amount: 3_000, message: "그냥 응원" });
    let view = (await getBroadcastView())!;
    expect(view.feed!.entries.map((e) => e.status)).toEqual(["UNMATCHED", "UNMATCHED", "ASSIGNED"]);
    expect(score(view, "cm-s1")).toBe(10_000);

    await assignFeedEntry({ broadcastId: id, entryId: view.feed!.entries[0].id, memberId: "cm-s3" });
    view = (await getBroadcastView())!;
    expect(score(view, "cm-s3")).toBe(3_000);
    // Inactive members cannot receive entries.
    expect((await assignFeedEntry({ broadcastId: id, entryId: view.feed!.entries[1].id, memberId: "cm-s4" })).status).toBe("INVALID");
  });

  it("BJ 이름 자동 인식: with it on, member names (2 letters or more) count as keywords", async () => {
    const m = await startLive();
    const sim = (n: number, message: string) => m.simulateDonation({ broadcastId: m.id, requestId: key(n), amount: 1_000, message });
    expect((await m.getBroadcastView())!.feed!.nameKeywords).toBe(false);
    await sim(1, "바다님 최고"); // off: 바다 has no keyword
    expect(await m.setNameKeywords({ on: true })).toEqual({ status: "SAVED" });
    await sim(2, "바다님 최고");
    await sim(3, "바다 하늘 둘 다"); // a name and another member's keyword: ambiguous
    const crew = await import("./crew");
    expect(await crew.addCrewMember({ requestId: crypto.randomUUID(), name: "별", role: "MEMBER" })).toEqual({ status: "SAVED" });
    await sim(4, "별빛 최고"); // a one-letter name never matches
    await sim(5, "솔 화이팅"); // 솔 is not active
    const view = (await m.getBroadcastView())!.feed!;
    expect(view.nameKeywords).toBe(true);
    expect(view.entries.map((e) => [e.message, e.status, e.memberId])).toEqual([
      ["솔 화이팅", "UNMATCHED", null],
      ["별빛 최고", "UNMATCHED", null],
      ["바다 하늘 둘 다", "UNMATCHED", null],
      ["바다님 최고", "ASSIGNED", "cm-s3"],
      ["바다님 최고", "UNMATCHED", null]
    ]);

    expect((await m.setNameKeywords({ on: "yes" })).status).toBe("INVALID");
    signIn(["SUPPORTER"]);
    expect(await m.setNameKeywords({ on: false })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("waits for confirmation in 확인 후 mode, and 취소 removes an entry from the score", async () => {
    const { simulateDonation, getBroadcastView, assignFeedEntry, cancelFeedEntry, setAssignMode, id } = await startLive();
    await setAssignMode({ broadcastId: id, mode: "CONFIRM" });
    await simulateDonation({ broadcastId: id, requestId: key(1), amount: 7_000, message: "하늘님 최고" });
    let view = (await getBroadcastView())!;
    const entry = view.feed!.entries[0];
    expect(entry).toMatchObject({ status: "PENDING", suggestedMemberId: "cm-s2" });
    expect(score(view, "cm-s2")).toBe(0);
    await assignFeedEntry({ broadcastId: id, entryId: entry.id, memberId: "cm-s2" });
    view = (await getBroadcastView())!;
    expect(score(view, "cm-s2")).toBe(7_000);
    await cancelFeedEntry({ broadcastId: id, entryId: entry.id });
    view = (await getBroadcastView())!;
    expect(score(view, "cm-s2")).toBe(0);
    expect(view.feed!.entries[0].status).toBe("CANCELLED");
  });

  it("collects a 한방 window and gives the pot to one member (or returns it on 취소)", async () => {
    const { simulateDonation, getBroadcastView, startOneshot, stopOneshot, getOverlayScoreboard, id } = await startLive();
    const { mockCreator } = await import("@/services/creator/mockCreatorStore");
    await startOneshot({ broadcastId: id });
    await simulateDonation({ broadcastId: id, requestId: key(1), amount: 4_000, message: "길동" });
    await simulateDonation({ broadcastId: id, requestId: key(2), amount: 6_000, message: "" });
    let view = (await getBroadcastView())!;
    expect(view.feed!.oneshot).toMatchObject({ potPoints: 10_000, count: 2 });
    expect(score(view, "cm-s1")).toBe(0);
    expect(await getOverlayScoreboard(mockCreator.integrationKey)).toMatchObject({ oneshotPot: 10_000 });

    await stopOneshot({ broadcastId: id, memberId: "cm-s3" });
    await stopOneshot({ broadcastId: id, memberId: "cm-s3" }); // double click → no-op
    view = (await getBroadcastView())!;
    expect(score(view, "cm-s3")).toBe(10_000);
    expect(view.feed!.entries.every((e) => e.oneshot)).toBe(true);

    await startOneshot({ broadcastId: id });
    await simulateDonation({ broadcastId: id, requestId: key(3), amount: 2_000, message: "하늘" });
    await stopOneshot({ broadcastId: id, memberId: null });
    view = (await getBroadcastView())!;
    expect(view.feed!.entries[0]).toMatchObject({ status: "ASSIGNED", memberId: "cm-s2", oneshot: false });
  });

  it("records real donations without a member target, numbers 회차 per project, and validates keywords", async () => {
    const { recordBroadcastDonation, getBroadcastView, endBroadcast, startBroadcast, setMemberKeywords, id } = await startLive("시즌1");
    recordBroadcastDonation("studio", { donor: "홍길동", shownDonor: "홍길동", message: "하늘 응원", fnAmount: 1_000 });
    recordBroadcastDonation("c1", { donor: "x", shownDonor: "x", message: "하늘", fnAmount: 1_000 }); // other channel: ignored
    let view = (await getBroadcastView())!;
    expect(view.live).toMatchObject({ project: "시즌1", round: 1 });
    expect(view.feed!.entries).toHaveLength(1);
    expect(view.feed!.entries[0]).toMatchObject({ source: "DONATION", memberId: "cm-s2" });

    await endBroadcast(id);
    await startBroadcast({ requestId: crypto.randomUUID(), title: "2회", project: "시즌1", teamMode: false });
    view = (await getBroadcastView())!;
    expect(view.live).toMatchObject({ round: 2 });
    expect(view.projects).toEqual(["시즌1"]);

    expect((await setMemberKeywords({ memberId: "cm-s3", keywords: ["하늘"] })).status).toBe("INVALID"); // taken by 하늘
    expect((await setMemberKeywords({ memberId: "cm-s3", keywords: ["x".repeat(13)] })).status).toBe("INVALID");
    signIn(["SUPPORTER"]);
    expect(await setMemberKeywords({ memberId: "cm-s3", keywords: [] })).toEqual({ status: "UNAUTHORIZED" });
  });
});

describe("중복 도네이션 확인", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.useRealTimers());

  it("marks a later entry with the same donor, amount and unit within 60 seconds, until the operator decides", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-25T12:00:00Z"), toFake: ["Date"] });
    const m = await startLive();
    const at = (s: string) => vi.setSystemTime(new Date(`2026-10-25T12:${s}Z`));
    let n = 0;
    const sim = (donor: string, amount: number, unit = "FN", message = "") => m.simulateDonation({ broadcastId: m.id, requestId: key(++n), donor, amount, unit, message });
    const list = async () => (await m.getBroadcastView())!.feed!.entries.slice().reverse(); // oldest first
    const marks = async () => (await list()).map((e) => (e.duplicateOf ? `${e.donor}→${e.duplicateOf.at.slice(14, 19)}` : "-"));

    await sim("별빛", 5_000, "FN", "하늘"); // A 00:00 (하늘)
    at("00:30");
    await sim(" 별 빛 ", 5_000); // B: same donor (spaces ignored) → 의심 of A
    at("00:40");
    await sim("별빛", 3_000); // other amount
    at("00:45");
    await sim("별빛", 5_000, "SOOP_BALLOON"); // other unit
    at("01:31");
    await sim("별빛", 5_000); // E: 61 s after B
    at("02:00");
    await sim("별빛", 5_000); // F: 29 s after E → 의심 of E
    expect(await marks()).toEqual(["-", "별 빛→00:00", "-", "-", "-", "별빛→01:31"]);

    // 중복 아님: the mark goes away, and a next one is checked against it.
    const [a, b, , , , f] = (await list()).map((e) => e.id);
    expect(await m.resolveDuplicate({ broadcastId: m.id, entryId: f, verdict: "KEPT" })).toEqual({ status: "SAVED" });
    at("02:20");
    await sim("별빛", 5_000); // G → 의심 of F
    expect((await marks()).slice(5)).toEqual(["-", "별빛→02:00"]);

    // 중복 취소: B is cancelled (no points); 배정 restores it as 중복 아님.
    await m.assignFeedEntry({ broadcastId: m.id, entryId: b, memberId: "cm-s3" });
    expect(score((await m.getBroadcastView())!, "cm-s3")).toBe(5_000);
    expect(await m.resolveDuplicate({ broadcastId: m.id, entryId: b, verdict: "DUPLICATE" })).toEqual({ status: "SAVED" });
    expect((await list())[1]).toMatchObject({ status: "CANCELLED", memberId: null, duplicate: "DUPLICATE", duplicateOf: null });
    expect(score((await m.getBroadcastView())!, "cm-s3")).toBe(0);
    expect((await m.resolveDuplicate({ broadcastId: m.id, entryId: b, verdict: "KEPT" })).status).toBe("INVALID"); // cancelled
    await m.assignFeedEntry({ broadcastId: m.id, entryId: b, memberId: "cm-s3" });
    expect((await list())[1]).toMatchObject({ status: "ASSIGNED", duplicate: "KEPT", duplicateOf: null });

    // A cancelled original no longer makes a 의심.
    await m.cancelFeedEntry({ broadcastId: m.id, entryId: a });
    at("02:30");
    await sim("기타", 1_000);
    await sim("기타", 1_000);
    expect((await marks()).slice(-2)).toEqual(["-", "기타→02:30"]);

    expect((await m.resolveDuplicate({ broadcastId: m.id, entryId: b, verdict: "MAYBE" })).status).toBe("INVALID");
    expect((await m.resolveDuplicate({ broadcastId: m.id, entryId: "fd-none", verdict: "KEPT" })).status).toBe("INVALID");
    await m.startOneshot({ broadcastId: m.id });
    await sim("기타", 1_000);
    const pot = (await list()).at(-1)!;
    expect(pot).toMatchObject({ status: "POT", duplicateOf: { at: "2026-10-25T12:02:30.000Z" } });
    expect((await m.resolveDuplicate({ broadcastId: m.id, entryId: pot.id, verdict: "DUPLICATE" })).status).toBe("INVALID"); // 한방 중
    signIn(["SUPPORTER"]);
    expect(await m.resolveDuplicate({ broadcastId: m.id, entryId: b, verdict: "KEPT" })).toEqual({ status: "UNAUTHORIZED" });
  });
});
