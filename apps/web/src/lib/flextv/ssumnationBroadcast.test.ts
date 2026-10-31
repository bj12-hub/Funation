import { describe, expect, it } from "vitest";
import { FlextvUnavailableError } from "./client";
import { gameResultText, mapControl, mapDecision, mapExtension, readChannelQuests, readGachaRemote, readMyDonations, readOverlay, readRouletteRemote } from "./ssumnationBroadcast";

/** The second half of the Ssumnation endpoints (docs/development/flextv-ssumnation-api.md §6–§9), in their shapes. */

describe("퀘스트 decisions and extensions", () => {
  it("maps a decision", () => {
    expect(mapDecision({ status: 200, data: { status: "OK", questStatus: "FAILED", refundedAmount: 3000 } })).toEqual({ status: "OK", questStatus: "FAILED", refundedFn: 3000 });
    expect(mapDecision({ status: 200, data: { status: "ALREADY_DECIDED", questStatus: "SUCCESS" } })).toEqual({ status: "ALREADY_DECIDED", questStatus: "SUCCESS" });
    expect(mapDecision({ status: 403, data: { status: "FORBIDDEN" } })).toEqual({ status: "FORBIDDEN" });
    expect(mapDecision({ status: 404, data: { status: "NOT_FOUND" } })).toEqual({ status: "NOT_FOUND" });
    expect(mapDecision({ status: 401, data: "Unauthorized" })).toEqual({ status: "UNAUTHORIZED" });
    expect(() => mapDecision({ status: 500, data: "InternalError" })).toThrow(FlextvUnavailableError);
  });

  it("maps an extension", () => {
    expect(mapExtension({ status: 200, data: { status: "OK", minutes: 10, endsAt: "2026-10-25T03:10:00Z", restarted: true } })).toEqual({ status: "OK", minutes: 10, endsAt: "2026-10-25T03:10:00Z", restarted: true });
    expect(mapExtension({ status: 200, data: { status: "DISABLED" } })).toEqual({ status: "DISABLED" });
    expect(mapExtension({ status: 400, data: { status: "INVALID", message: "이미 다른 시간으로 연장했어요." } })).toEqual({ status: "INVALID", message: "이미 다른 시간으로 연장했어요." });
    expect(mapExtension({ status: 400, data: { status: "INVALID", message: "Error: x" } })).toEqual({ status: "INVALID", message: "시간을 연장하지 못했어요." });
  });
});

describe("lists", () => {
  it("reads the streamer's quests without anything malformed", () => {
    const page = readChannelQuests({
      data: [
        { id: "q7", donorNickname: "열혈시청자", title: "노래", amount: 3000, status: "IN_PROGRESS", createdAt: "2026-10-25T01:00:00Z", decidedAt: null, endsAt: "2026-10-25T02:00:00Z", extendedMin: 10, creatorDecides: true },
        { id: "q8", status: "WHATEVER", createdAt: "2026-10-25T01:00:00Z", endsAt: "2026-10-25T02:00:00Z" }
      ],
      count: 2,
      held: { amount: 3000, count: 1 },
      allowExtension: true,
      serverNow: "2026-10-25T01:20:00Z"
    });
    expect(page.items).toEqual([{ id: "q7", donorNickname: "열혈시청자", title: "노래", amount: 3000, status: "IN_PROGRESS", createdAt: "2026-10-25T01:00:00Z", decidedAt: null, endsAt: "2026-10-25T02:00:00Z", extendedMin: 10, creatorDecides: true }]);
    expect(page).toMatchObject({ count: 2, held: { amount: 3000, count: 1 }, allowExtension: true, serverNow: "2026-10-25T01:20:00Z" });
  });

  it("reads the supporter's quests and games, and words a result like the mock", () => {
    const { items } = readMyDonations({
      data: [
        { id: 88812, donatedAt: "2026-10-25T01:00:00Z", channelId: 3021, channelName: "방송국", type: "QUEST", amount: 3000, message: "노래", status: "PROCESSING", refundedAt: null, quest: { id: "q7", status: "IN_PROGRESS", endsAt: "2026-10-25T02:00:00Z", extendedMin: 0 }, game: null },
        { id: 88813, donatedAt: "2026-10-25T01:05:00Z", channelId: 3021, channelName: "방송국", type: "ROULETTE", amount: 500, message: "", status: "COMPLETED", quest: null, game: { kind: "ROULETTE", status: "RESULT", result: "애교", blank: false } }
      ],
      count: 2
    });
    expect(items[0]).toMatchObject({ id: "88812", channelId: "3021", quest: { id: "q7", status: "IN_PROGRESS" }, game: null });
    expect(gameResultText(items[1].game!)).toBe("룰렛 결과 · 애교 당첨");
    expect(gameResultText({ kind: "ROULETTE", status: "QUEUED", result: null, blank: null })).toBe("룰렛 대기 중");
    expect(gameResultText({ kind: "ROULETTE", status: "WAITING", result: null, blank: null })).toBe("룰렛 결과 대기");
    expect(gameResultText({ kind: "GACHA", status: "RESULT", result: "꽝", blank: true })).toBe("뽑기 결과 · 꽝");
    expect(gameResultText({ kind: "GACHA", status: "SPINNING", result: null, blank: null })).toBe("뽑는 중");
  });
});

describe("the 리모컨", () => {
  it("never shows a result before it is revealed", () => {
    const view = readRouletteRemote({
      enabled: true,
      autoStart: false,
      autoReveal: false,
      paused: false,
      hidden: false,
      dailyLimit: 3,
      items: [{ name: "노래", percent: 40 }, { name: "꽝", percent: 60 }],
      stage: { id: "s1", no: "#RLT-00001", status: "WAITING", donor: "팬", amount: 500, items: [], nth: 1, limit: 3, result: "노래", endsAt: "2026-10-25T01:00:08Z" },
      queue: [{ id: "s2", no: "#RLT-00002", donor: "팬2", amount: 500, createdAt: "2026-10-25T01:00:00Z", nth: 1, status: "QUEUED", result: "꽝" }],
      recent: [],
      participantsToday: 2
    });
    expect(view.stage).toMatchObject({ status: "WAITING", result: null });
    expect(view.queue[0].result).toBeNull();
    expect(view.dailyLimit).toBe(3);
  });

  it("reads the 뽑기 with Ssumnation's machine look, and no claim for a 꽝", () => {
    const view = readGachaRemote({
      stage: { id: "d1", no: "#GCH-00001", status: "RESULT", gachaName: "행운 뽑기", donor: "팬", amount: 1000, message: "", prize: "사인", blank: false, endsAt: "2026-10-25T01:00:08Z" },
      queue: [],
      recent: [{ id: "d0", no: "#GCH-00000", gachaName: "행운 뽑기", donor: "팬", amount: 1000, createdAt: "2026-10-25T00:59:00Z", status: "DONE", prize: "꽝", blank: true, claimed: true }],
      unclaimed: 1,
      hidden: false
    });
    expect(view.stage).toMatchObject({ prize: "사인", style: "CAPSULE" });
    expect(view.recent[0]).toMatchObject({ prize: "꽝", blank: true, claimed: null });
  });

  it("maps a button's answer", () => {
    expect(mapControl({ status: 200, data: { status: "SAVED" } })).toEqual({ status: "SAVED" });
    expect(mapControl({ status: 400, data: { status: "INVALID", message: "대기 중인 참여가 없어요." } })).toEqual({ status: "INVALID", message: "대기 중인 참여가 없어요." });
    expect(mapControl({ status: 403, data: null })).toEqual({ status: "UNAUTHORIZED" });
  });
});

describe("overlays", () => {
  it("reads each game's state", () => {
    expect(readOverlay("mini", { lines: [{ id: "m1", nickname: "팬", amount: 500, text: "안녕" }, { id: "m2", nickname: "팬" }] })).toEqual({ widget: "mini", lines: [{ id: "m1", nickname: "팬", amount: "500 FN", text: "안녕", fn: 500 }] });
    // The 뽑기's id, for its look (phase 8).
    expect(readOverlay("gacha", { stage: { id: "d1", gachaId: "g-1", status: "SPINNING", endsAt: "2026-10-25T02:00:00Z" }, history: [] })).toMatchObject({ gachaId: "g-1" });
    expect(readOverlay("quest", { quests: [{ id: "q7", title: "노래", amount: 3000, endsAt: "2026-10-25T02:00:00Z", extendedMin: 0 }] })).toMatchObject({ quests: [{ id: "q7", amount: 3000 }] });
    expect(readOverlay("roulette", { stage: null })).toEqual({ widget: "roulette", stage: null });
  });
});
