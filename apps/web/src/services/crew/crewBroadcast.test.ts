import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 크루 방송 (code-first): one live broadcast, scores = donations during it + 보정, idempotent 보정. */
async function load() {
  const bc = await import("./crewBroadcast");
  const core = await import("./crewCore");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  return { ...bc, ...core, overlayKey: mockCreator.integrationKey };
}

describe("크루 방송", () => {
  beforeEach(() => resetMockStores());

  it("scores donations made during the broadcast plus 보정, and freezes the result on end", async () => {
    const { startBroadcast, adjustScore, endBroadcast, getBroadcastView, attributeMemberDonation } = await load();
    expect(await startBroadcast({ title: "시즌1 1회", teamMode: false })).toEqual({ status: "SAVED" });
    let view = (await getBroadcastView())!;
    const liveId = view.live!.id;
    // Seed attributions happened before the start and must not count.
    expect(view.live!.rows.every((r) => r.score === 0)).toBe(true);
    attributeMemberDonation("dn-t1", "studio", "cm-s2", 5_000);
    expect(await adjustScore({ broadcastId: liveId, memberId: "cm-s1", points: 3_000, reason: "미션 성공", adjustmentId: key(1) })).toEqual({ status: "SAVED" });
    // The same 보정 id is applied once.
    await adjustScore({ broadcastId: liveId, memberId: "cm-s1", points: 3_000, reason: "미션 성공", adjustmentId: key(1) });
    view = (await getBroadcastView())!;
    expect(view.live!.rows.slice(0, 2).map((r) => [r.memberId, r.score])).toEqual([
      ["cm-s2", 5_000],
      ["cm-s1", 3_000]
    ]);
    expect(await endBroadcast(liveId)).toEqual({ status: "SAVED" });
    expect(await endBroadcast(liveId)).toEqual({ status: "SAVED" }); // idempotent
    view = (await getBroadcastView())!;
    expect(view.live).toBeNull();
    expect(view.history[0]).toMatchObject({ title: "시즌1 1회", totalScore: 8_000, winner: "하늘" });
  });

  it("allows only one live broadcast and validates team battles", async () => {
    const { startBroadcast } = await load();
    expect((await startBroadcast({ title: "", teamMode: false })).status).toBe("INVALID");
    expect((await startBroadcast({ title: "팀전", teamMode: true, teams: { "cm-s1": "A" } })).status).toBe("INVALID");
    expect((await startBroadcast({ title: "팀전", teamMode: true, teams: { "cm-s1": "A", "cm-s4": "B" } })).status).toBe("INVALID"); // cm-s4 is 휴식
    expect(await startBroadcast({ title: "팀전", teamMode: true, teams: { "cm-s1": "A", "cm-s2": "B" } })).toEqual({ status: "SAVED" });
    expect((await startBroadcast({ title: "두 번째", teamMode: false })).status).toBe("INVALID");
  });

  it("rejects bad 보정 input", async () => {
    const { startBroadcast, adjustScore, getBroadcastView } = await load();
    await startBroadcast({ title: "보정 테스트", teamMode: false });
    const id = (await getBroadcastView())!.live!.id;
    const bad = [
      { broadcastId: "other", memberId: "cm-s1", points: 1, adjustmentId: key(2) },
      { broadcastId: id, memberId: "nobody", points: 1, adjustmentId: key(3) },
      { broadcastId: id, memberId: "cm-s1", points: 0, adjustmentId: key(4) },
      { broadcastId: id, memberId: "cm-s1", points: 1.5, adjustmentId: key(5) },
      { broadcastId: id, memberId: "cm-s1", points: 1, adjustmentId: "short" },
      { broadcastId: id, memberId: "cm-s1", points: 1, reason: "가".repeat(41), adjustmentId: key(6) }
    ];
    for (const b of bad) expect((await adjustScore(b)).status).toBe("INVALID");
  });

  it("serves the overlay only with the integration key and requires the Creator role for the remote", async () => {
    const { startBroadcast, getOverlayScoreboard, overlayKey } = await load();
    expect(await getOverlayScoreboard("wrong")).toBe("FORBIDDEN");
    expect(await getOverlayScoreboard(overlayKey)).toBe("IDLE");
    await startBroadcast({ title: "오버레이", teamMode: false });
    const live = await getOverlayScoreboard(overlayKey);
    expect(typeof live === "object" && live.title).toBe("오버레이");
    signIn(["SUPPORTER"]);
    expect((await startBroadcast({ title: "침입", teamMode: false })).status).toBe("UNAUTHORIZED");
  });
});
