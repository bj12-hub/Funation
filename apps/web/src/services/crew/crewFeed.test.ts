import { beforeEach, describe, expect, it, vi } from "vitest";
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
