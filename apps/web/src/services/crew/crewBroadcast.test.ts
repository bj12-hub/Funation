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
    expect(await startBroadcast({ requestId: crypto.randomUUID(), title: "시즌1 1회", teamMode: false })).toEqual({ status: "SAVED" });
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
    expect((await startBroadcast({ requestId: crypto.randomUUID(), title: "", teamMode: false })).status).toBe("INVALID");
    expect((await startBroadcast({ requestId: crypto.randomUUID(), title: "팀전", teamMode: true, teams: { "cm-s1": "A" } })).status).toBe("INVALID");
    expect((await startBroadcast({ requestId: crypto.randomUUID(), title: "팀전", teamMode: true, teams: { "cm-s1": "A", "cm-s4": "B" } })).status).toBe("INVALID"); // cm-s4 is 휴식
    expect(await startBroadcast({ requestId: crypto.randomUUID(), title: "팀전", teamMode: true, teams: { "cm-s1": "A", "cm-s2": "B" } })).toEqual({ status: "SAVED" });
    expect((await startBroadcast({ requestId: crypto.randomUUID(), title: "두 번째", teamMode: false })).status).toBe("INVALID");
  });

  it("starts one broadcast per request and ends it once, even on a double click", async () => {
    const { startBroadcast, endBroadcast, getBroadcastView } = await load();
    const { mockCrew } = await import("./mockCrewStore");
    const studio = () => (mockCrew.broadcasts ?? []).filter((b) => b.channelId === "studio");
    const start = (requestId: string, title = "더블클릭") => startBroadcast({ requestId, title, teamMode: false });
    expect((await startBroadcast({ title: "아이디없음", teamMode: false })).status).toBe("INVALID");

    // Two different start requests at once: one live broadcast.
    const both = await Promise.all([start(key(1)), start(key(2))]);
    expect(both.map((r) => r.status).sort()).toEqual(["INVALID", "SAVED"]);
    expect(studio()).toHaveLength(1);
    const first = studio()[0];
    // The start that won, retried: SAVED, still one broadcast — also after it ended.
    const won = first.requestId!;
    expect(await start(won)).toEqual({ status: "SAVED" });

    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(Date.parse(first.startedAt) + 60_000);
      expect(await Promise.all([endBroadcast(first.id), endBroadcast(first.id)])).toEqual([{ status: "SAVED" }, { status: "SAVED" }]);
      const ended = { endedAt: first.endedAt, final: structuredClone(first.final) };
      vi.setSystemTime(Date.parse(first.startedAt) + 120_000);
      expect(await endBroadcast(first.id)).toEqual({ status: "SAVED" }); // a late retry changes nothing
      expect({ endedAt: first.endedAt, final: first.final }).toEqual(ended);
      expect(await start(won)).toEqual({ status: "SAVED" });
      expect(studio()).toHaveLength(1);
      expect((await getBroadcastView())!.live).toBeNull();
    } finally {
      vi.useRealTimers();
    }
    expect(first.id).toMatch(/^bc-[0-9a-f-]{36}$/);
  });

  it("rejects bad 보정 input", async () => {
    const { startBroadcast, adjustScore, getBroadcastView } = await load();
    await startBroadcast({ requestId: crypto.randomUUID(), title: "보정 테스트", teamMode: false });
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
    await startBroadcast({ requestId: crypto.randomUUID(), title: "오버레이", teamMode: false });
    const live = await getOverlayScoreboard(overlayKey);
    expect(typeof live === "object" && live.title).toBe("오버레이");
    signIn(["SUPPORTER"]);
    expect((await startBroadcast({ requestId: crypto.randomUUID(), title: "침입", teamMode: false })).status).toBe("UNAUTHORIZED");
  });
});
