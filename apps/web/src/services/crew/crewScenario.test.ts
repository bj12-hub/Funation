import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 콘텐츠 시나리오 도우미 (code-first): plan 1부 ~ 5부, move part to part, auto 서브 점수판. */
async function load() {
  const bc = await import("./crewBroadcast");
  const scen = await import("./crewScenario");
  const view = async () => (await bc.getBroadcastView())!;
  return { ...bc, ...scen, view };
}

const PLAN = [
  { title: "오프닝", minutes: 10, memo: "인사 · 오늘 룰 소개", openBoard: false },
  { title: "직급전", minutes: 60, memo: "", openBoard: true },
  { title: "", minutes: null, memo: "엔딩", openBoard: false }
];

describe("콘텐츠 시나리오 도우미", () => {
  beforeEach(() => resetMockStores());

  it("validates and keeps the plan across broadcasts", async () => {
    const { setScenario, view } = await load();
    expect((await setScenario({ parts: Array.from({ length: 6 }, () => PLAN[0]) })).status).toBe("INVALID");
    expect((await setScenario({ parts: [{ ...PLAN[0], minutes: 0 }] })).status).toBe("INVALID");
    expect((await setScenario({ parts: [{ ...PLAN[0], title: "x".repeat(21) }] })).status).toBe("INVALID");
    expect(await setScenario({ parts: PLAN })).toEqual({ status: "SAVED" });
    expect((await view()).scenario).toEqual(PLAN);
    signIn(["SUPPORTER"]);
    expect(await setScenario({ parts: [] })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("moves part to part once per click, opens a part's 서브 점수판 and closes with 방송 종료", async () => {
    const { setScenario, startBroadcast, startScenarioPart, finishScenario, endBroadcast, getOverlayScoreboard, view } = await load();
    const { mockCreator } = await import("@/services/creator/mockCreatorStore");
    await startBroadcast({ requestId: crypto.randomUUID(), title: "시나리오 방송", teamMode: false });
    const id = (await view()).live!.id;
    expect((await startScenarioPart({ broadcastId: id, index: 0, requestId: key(1) })).status).toBe("INVALID"); // no plan yet
    await setScenario({ parts: PLAN });

    expect(await startScenarioPart({ broadcastId: id, index: 0, requestId: key(2) })).toEqual({ status: "SAVED" });
    expect(await startScenarioPart({ broadcastId: id, index: 1, requestId: key(3) })).toEqual({ status: "SAVED" });
    expect(await startScenarioPart({ broadcastId: id, index: 2, requestId: key(3) })).toEqual({ status: "SAVED" }); // same click → ignored
    let live = (await view()).live!;
    expect(live.scenario).toMatchObject({ current: 1 });
    expect(live.scenario!.history.map((h) => [h.title, h.endedAt !== null])).toEqual([["오프닝", true], ["직급전", false]]);
    expect(live.subBoards.map((b) => [b.title, b.closedAt])).toEqual([["2부 · 직급전", null]]);

    // Plan edits during the broadcast apply next time.
    await setScenario({ parts: [PLAN[2]] });
    live = (await view()).live!;
    expect(live.scenario!.parts).toHaveLength(3);
    const overlay = await getOverlayScoreboard(mockCreator.integrationKey);
    expect(overlay !== "IDLE" && overlay !== "FORBIDDEN" && overlay.scenario).toMatchObject({ current: 1 });

    await finishScenario({ broadcastId: id });
    await finishScenario({ broadcastId: id });
    expect((await view()).live!.scenario).toMatchObject({ current: null });
    expect((await startScenarioPart({ broadcastId: id, index: 5, requestId: key(4) })).status).toBe("INVALID");
    await startScenarioPart({ broadcastId: id, index: 2, requestId: key(5) });
    await endBroadcast(id);
    expect((await startScenarioPart({ broadcastId: id, index: 0, requestId: key(6) })).status).toBe("INVALID"); // not live
  });
});
